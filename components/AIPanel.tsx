"use client";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { api, aiApi, tagApi, getErrorMessage } from "@/lib/client";

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

interface TagSuggestion {
  tag_id: number | null;
  name: string;
  isNew: boolean;
  color: string;
}

interface WeakArea {
  concept: string;
  explanation: string;
  suggested_cards: { front: string; back: string }[];
}

interface Prerequisite {
  concept: string;
  importance: "required" | "helpful";
}

type Mode = "summarize" | "quiz" | "explain" | "concept-map" | "weakness" | "auto-tag" | "prerequisites" | null;

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

function ConceptMapView({ mermaid, concepts }: { mermaid: string; concepts: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgError, setSvgError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    import("mermaid").then((m) => {
      if (cancelled) return;
      m.default.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
      const id = `cm-${Date.now()}`;
      m.default.render(id, mermaid).then(({ svg }) => {
        if (!cancelled && containerRef.current) containerRef.current.innerHTML = svg;
      }).catch(() => { if (!cancelled) setSvgError(true); });
    });
    return () => { cancelled = true; };
  }, [mermaid]);

  return (
    <div>
      {svgError ? (
        <pre style={{ fontSize: 11, overflowX: "auto", background: "var(--surface-soft)", padding: 8, borderRadius: 6 }}>{mermaid}</pre>
      ) : (
        <div ref={containerRef} style={{ overflowX: "auto", marginBottom: 12 }} />
      )}
      {concepts.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>KEY CONCEPTS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {concepts.map((c, i) => (
              <span key={i} className="tag-chip" style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent)", fontSize: 12 }}>{c}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WeaknessView({ weakAreas }: { weakAreas: WeakArea[] }) {
  const [expanded, setExpanded] = useState<number | null>(0);
  return (
    <div>
      {weakAreas.map((area, i) => (
        <div key={i} style={{ marginBottom: 10, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <div
            style={{ padding: "10px 12px", background: "var(--surface-soft)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 600, fontSize: 13 }}
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <span>⚠️ {area.concept}</span>
            <span style={{ color: "var(--text-muted)" }}>{expanded === i ? "▲" : "▼"}</span>
          </div>
          {expanded === i && (
            <div style={{ padding: "10px 12px" }}>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>{area.explanation}</p>
              {area.suggested_cards?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>SUGGESTED FLASHCARDS</div>
                  {area.suggested_cards.map((card, ci) => (
                    <div key={ci} style={{ background: "var(--surface-soft)", borderRadius: 6, padding: "8px 10px", marginBottom: 6, fontSize: 13 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>Q: {card.front}</div>
                      <div style={{ color: "var(--text-muted)" }}>A: {card.back}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TagSuggestionsView({ suggestions, pageId, onApplied }: { suggestions: TagSuggestion[]; pageId: number; onApplied: () => void }) {
  const [states, setStates] = useState<("idle" | "loading" | "done")[]>(suggestions.map(() => "idle"));

  const applyTag = async (suggestion: TagSuggestion, index: number) => {
    const updated = [...states];
    updated[index] = "loading";
    setStates(updated);
    try {
      let tagId = suggestion.tag_id;
      if (suggestion.isNew || tagId === null) {
        const newTag = await tagApi.create(suggestion.name, suggestion.color);
        tagId = newTag.id;
      }
      await tagApi.addToPage(pageId, tagId!);
      updated[index] = "done";
      setStates([...updated]);
    } catch {
      updated[index] = "idle";
      setStates([...updated]);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>Click a tag to apply it to this page</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {suggestions.map((s, i) => (
          <button
            key={i}
            disabled={states[i] !== "idle"}
            onClick={() => applyTag(s, i)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              borderRadius: 20,
              border: `1px solid ${s.color}`,
              background: states[i] === "done" ? s.color : "transparent",
              color: states[i] === "done" ? "#fff" : s.color,
              fontSize: 13,
              cursor: states[i] === "idle" ? "pointer" : "default",
              fontWeight: 500,
              transition: "all 0.2s",
            }}
          >
            {states[i] === "loading" ? "…" : states[i] === "done" ? "✓ " : "+ "}
            {s.name}
            {s.isNew && states[i] === "idle" && <span style={{ fontSize: 10, opacity: 0.7 }}>new</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function PrerequisitesView({ prerequisites }: { prerequisites: Prerequisite[] }) {
  const required = prerequisites.filter(p => p.importance === "required");
  const helpful = prerequisites.filter(p => p.importance === "helpful");
  return (
    <div>
      {required.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--danger)", marginBottom: 6 }}>🔴 REQUIRED — you must know these</div>
          {required.map((p, i) => (
            <div key={i} style={{ padding: "6px 10px", background: "var(--surface-soft)", borderRadius: 6, marginBottom: 5, fontSize: 13, borderLeft: "3px solid var(--danger)" }}>
              {p.concept}
            </div>
          ))}
        </div>
      )}
      {helpful.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--warning, #f59e0b)", marginBottom: 6 }}>🟡 HELPFUL — aids understanding</div>
          {helpful.map((p, i) => (
            <div key={i} style={{ padding: "6px 10px", background: "var(--surface-soft)", borderRadius: 6, marginBottom: 5, fontSize: 13, borderLeft: "3px solid var(--warning, #f59e0b)" }}>
              {p.concept}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AIPanel({ pageId, notebookId }: { pageId: number; notebookId?: number }) {
  const [mode, setMode] = useState<Mode>(null);
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [socraticMode, setSocraticMode] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[] | null>(null);
  const [quizNotebookId, setQuizNotebookId] = useState<number>(0);
  const [conceptMap, setConceptMap] = useState<{ mermaid: string; concepts: string[] } | null>(null);
  const [weakAreas, setWeakAreas] = useState<WeakArea[] | null>(null);
  const [tagSuggestions, setTagSuggestions] = useState<TagSuggestion[] | null>(null);
  const [prerequisites, setPrerequisites] = useState<Prerequisite[] | null>(null);

  const clearResults = () => {
    setOutput("");
    setQuizQuestions(null);
    setConceptMap(null);
    setWeakAreas(null);
    setTagSuggestions(null);
    setPrerequisites(null);
    setError("");
  };

  const run = async (newMode: Mode) => {
    if (!newMode) return;
    setMode(newMode);
    clearResults();

    if (newMode === "explain" && !question.trim()) {
      setError("Type a question for the AI tutor first");
      return;
    }
    if (newMode === "weakness" && !notebookId) {
      setError("Notebook context required for weakness analysis");
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
        const res = await api.post<{ answer: string }>("/ai/explain", {
          page_id: pageId,
          question,
          mode: socraticMode ? "socratic" : "explain",
        });
        setOutput(res.data.answer);
      } else if (newMode === "concept-map") {
        const result = await aiApi.conceptMap({ page_id: pageId });
        setConceptMap(result);
      } else if (newMode === "weakness") {
        const result = await aiApi.weaknessAnalysis(notebookId!);
        setWeakAreas(result.weak_areas);
      } else if (newMode === "auto-tag") {
        const result = await aiApi.suggestTags(pageId);
        setTagSuggestions(result.suggested);
      } else if (newMode === "prerequisites") {
        const result = await aiApi.prerequisites({ page_id: pageId });
        setPrerequisites(result.prerequisites);
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const resetQuiz = () => { setQuizQuestions(null); setMode(null); };

  const outputLabel = mode === "explain" && socraticMode ? "Socratic Questions" : null;

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">🤖 <span>AI Study Assistant</span></div>

      <div className="ai-actions">
        <button className="btn btn-secondary" onClick={() => run("summarize")} disabled={loading}>✨ Summarize</button>
        <button className="btn btn-secondary" onClick={() => run("quiz")} disabled={loading}>🎯 Quiz me</button>
        <button className="btn btn-secondary" onClick={() => run("concept-map")} disabled={loading}>🗺️ Concept Map</button>
        <button className="btn btn-secondary" onClick={() => run("prerequisites")} disabled={loading}>📚 Prerequisites</button>
        <button className="btn btn-secondary" onClick={() => run("auto-tag")} disabled={loading}>🏷️ Suggest Tags</button>
        <button
          className="btn btn-secondary"
          onClick={() => run("weakness")}
          disabled={loading || !notebookId}
          title={!notebookId ? "Notebook context required" : "Analyze weak areas from your review history"}
        >
          📊 Weaknesses
        </button>
      </div>

      <div className="flex gap-2" style={{ alignItems: "center" }}>
        <input
          className="input"
          placeholder="Ask the AI tutor about these notes..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run("explain")}
          style={{ flex: 1 }}
        />
        <button
          className={`btn ${socraticMode ? "btn-primary" : "btn-ghost"}`}
          style={{ whiteSpace: "nowrap", fontSize: 12, padding: "6px 8px" }}
          onClick={() => setSocraticMode(s => !s)}
          title={socraticMode ? "Socratic mode ON — AI will ask guiding questions" : "Switch to Socratic mode"}
        >
          🤔
        </button>
        <button className="btn btn-primary" onClick={() => run("explain")} disabled={loading}>Ask</button>
      </div>
      {socraticMode && (
        <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>Socratic mode: AI guides you with questions instead of answers</div>
      )}

      {loading && (
        <div className="ai-output muted">
          <span className="spinner" /> Thinking...
        </div>
      )}
      {!loading && error && <div className="ai-output error">⚠️ {error}</div>}

      {!loading && !error && quizQuestions && (
        <div className="ai-output" style={{ padding: "10px 0" }}>
          <InteractiveQuiz questions={quizQuestions} notebookId={quizNotebookId} onDone={resetQuiz} />
        </div>
      )}

      {!loading && !error && conceptMap && (
        <div className="ai-output">
          <ConceptMapView mermaid={conceptMap.mermaid} concepts={conceptMap.concepts} />
        </div>
      )}

      {!loading && !error && weakAreas && (
        <div className="ai-output">
          <WeaknessView weakAreas={weakAreas} />
        </div>
      )}

      {!loading && !error && tagSuggestions && (
        <div className="ai-output">
          <TagSuggestionsView suggestions={tagSuggestions} pageId={pageId} onApplied={() => setTagSuggestions(null)} />
        </div>
      )}

      {!loading && !error && prerequisites && (
        <div className="ai-output">
          <PrerequisitesView prerequisites={prerequisites} />
        </div>
      )}

      {!loading && !error && !quizQuestions && !conceptMap && !weakAreas && !tagSuggestions && !prerequisites && output && (
        <div className="ai-output">
          {outputLabel && <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", marginBottom: 6 }}>{outputLabel}</div>}
          <ReactMarkdown>{output}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
