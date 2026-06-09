import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { aiApi, getErrorMessage } from "../api/client";

type Mode = "summarize" | "quiz" | "explain" | null;

export default function AIPanel({ pageId }: { pageId: number }) {
  const [mode, setMode] = useState<Mode>(null);
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");

  const run = async (newMode: "summarize" | "quiz" | "explain") => {
    setMode(newMode);
    setError("");
    setOutput("");
    if (newMode === "explain" && !question.trim()) {
      setError("Type a question for the AI tutor first");
      return;
    }
    setLoading(true);
    try {
      let result = "";
      if (newMode === "summarize") result = await aiApi.summarize(pageId);
      if (newMode === "quiz") result = await aiApi.quiz(pageId, 5);
      if (newMode === "explain") result = await aiApi.explain(pageId, question);
      setOutput(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        🤖 <span>AI Study Assistant</span>
      </div>

      <div className="ai-actions">
        <button
          className="btn btn-secondary"
          onClick={() => run("summarize")}
          disabled={loading}
        >
          ✨ Summarize
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => run("quiz")}
          disabled={loading}
        >
          🎯 Quiz me
        </button>
      </div>

      <div className="flex gap-2">
        <input
          className="input"
          placeholder="Ask the AI tutor about these notes..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run("explain")}
        />
        <button
          className="btn btn-primary"
          onClick={() => run("explain")}
          disabled={loading}
        >
          Ask
        </button>
      </div>

      {loading && (
        <div className="ai-output muted">
          <span className="spinner" /> Thinking with{" "}
          {mode === "summarize"
            ? "your notes"
            : mode === "quiz"
            ? "quiz questions"
            : "your question"}
          ...
        </div>
      )}

      {!loading && error && <div className="ai-output error">⚠️ {error}</div>}

      {!loading && !error && output && (
        <div className="ai-output">
          <ReactMarkdown>{output}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
