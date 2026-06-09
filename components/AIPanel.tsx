"use client";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { api, aiApi, getErrorMessage } from "@/lib/client";

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

interface QuizAttempt {
  id: number;
  score: number;
  total: number;
  created_at: string;
}

type Mode = "summarize" | "quiz" | "explain" | null;

function InteractiveQuiz({
  questions,
  notebookId,
  onDone,
}: {
  questions: QuizQuestion[];
  notebookId: number;
  onDone: () => void;
}) {
  const [answers, setAnswers] = useState<number[]>(new Array(questions.length).fill(-1));
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState<QuizAttempt[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const submit = async () => {
    const s = questions.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0);
    setScore(s);
    setSubmitted(true);
    try {
      await api.post("/quiz-attempts", { notebook_id: notebookId, score: s, total: questions.length });
    } catch {}
  };

  const loadHistory = async () => {
    try {
      const res = await api.get<{ attempts: QuizAttempt[] }>(`/quiz-attempts?notebook_id=${notebookId}`);
      setHistory(res.data.attempts);
      setShowHistory(true);
    } catch {}
  };

  if (showHistory && history) {
    return (
      <div>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Quiz History</div>
        {history.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>No history yet.</div>
        ) : (
          history.map(a => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span>{new Date(a.created_at).toLocaleDateString()}</span>
              <span style={{ fontWeight: 600, color: a.score / a.total >= 0.7 ? "var(--success)" : "var(--danger)" }}>
                {a.score}/{a.total}
              </span>
            </div>
          ))
        )}
        <button className="btn btn-secondary" style={{ marginTop: 12, width: "100%", fontSize: 13 }} onClick={() => setShowHistory(false)}>
          ← Back
        </button>
      </div>
    );
  }

  if (submitted) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div>
        <div className="quiz-results">
          <div className="quiz-score-big">{score}/{questions.length}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>{pct}% correct</div>
        </div>
        {questions.map((q, qi) => (
          <div key={qi} className="quiz-question">
            <div className="quiz-question-text">{qi + 1}. {q.question}</div>
            {q.options.map((opt, oi) => {
              const isCorrect = oi === q.correct;
              const isChosen = answers[qi] === oi;
              let cls = "quiz-option";
              if (isCorrect) cls += " correct";
              else if (isChosen && !isCorrect) cls += " incorrect";
              return <div key={oi} className={cls}>{opt}</div>;
            })}
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn btn-secondary" style={{ flex: 1, fontSize: 13 }} onClick={loadHistory}>
            📊 History
          </button>
          <button className="btn btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    );
  }

  const allAnswered = answers.every(a => a !== -1);

  return (
    <div>
      {questions.map((q, qi) => (
        <div key={qi} className="quiz-question">
          <div className="quiz-question-text">{qi + 1}. {q.question}</div>
          {q.options.map((opt, oi) => (
            <div
              key={oi}
              className={`quiz-option${answers[qi] === oi ? " correct" : ""}`}
              style={answers[qi] === oi ? { background: "var(--accent-soft)", borderColor: "var(--accent)" } : {}}
              onClick={() => {
                const updated = [...answers];
                updated[qi] = oi;
                setAnswers(updated);
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      ))}
      <button
        className="btn btn-primary"
        style={{ width: "100%", marginTop: 8 }}
        onClick={submit}
        disabled={!allAnswered}
      >
        Submit quiz
      </button>
    </div>
  );
}

export default function AIPanel({ pageId }: { pageId: number }) {
  const [mode, setMode] = useState<Mode>(null);
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[] | null>(null);
  const [quizNotebookId, setQuizNotebookId] = useState<number>(0);

  const run = async (newMode: "summarize" | "quiz" | "explain") => {
    setMode(newMode);
    setError("");
    setOutput("");
    setQuizQuestions(null);
    if (newMode === "explain" && !question.trim()) {
      setError("Type a question for the AI tutor first");
      return;
    }
    setLoading(true);
    try {
      if (newMode === "summarize") {
        const result = await aiApi.summarize(pageId);
        setOutput(result);
      } else if (newMode === "quiz") {
        const res = await api.post<{ questions?: QuizQuestion[]; quiz?: string; notebook_id: number }>(
          "/ai/quiz", { page_id: pageId, count: 5 }
        );
        if (res.data.questions) {
          setQuizQuestions(res.data.questions);
          setQuizNotebookId(res.data.notebook_id);
        } else {
          setOutput(res.data.quiz || "");
        }
      } else if (newMode === "explain") {
        const result = await aiApi.explain(pageId, question);
        setOutput(result);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const resetQuiz = () => { setQuizQuestions(null); setMode(null); };

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">🤖 <span>AI Study Assistant</span></div>

      <div className="ai-actions">
        <button className="btn btn-secondary" onClick={() => run("summarize")} disabled={loading}>✨ Summarize</button>
        <button className="btn btn-secondary" onClick={() => run("quiz")} disabled={loading}>🎯 Quiz me</button>
      </div>

      <div className="flex gap-2">
        <input
          className="input"
          placeholder="Ask the AI tutor about these notes..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run("explain")}
        />
        <button className="btn btn-primary" onClick={() => run("explain")} disabled={loading}>Ask</button>
      </div>

      {loading && (
        <div className="ai-output muted">
          <span className="spinner" /> Thinking...
        </div>
      )}
      {!loading && error && <div className="ai-output error">⚠️ {error}</div>}
      {!loading && !error && quizQuestions && (
        <div className="ai-output" style={{ padding: "10px 0" }}>
          <InteractiveQuiz
            questions={quizQuestions}
            notebookId={quizNotebookId}
            onDone={resetQuiz}
          />
        </div>
      )}
      {!loading && !error && !quizQuestions && output && (
        <div className="ai-output"><ReactMarkdown>{output}</ReactMarkdown></div>
      )}
    </div>
  );
}
