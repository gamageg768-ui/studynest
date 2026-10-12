"use client";
import { useEffect, useState } from "react";
import { api, aiApi } from "@/lib/client";
import { getSocket } from "@/lib/socket";

interface QBState {
  active: boolean;
  currentQ: number;
  scores: Record<number, { display_name: string; points: number }>;
  participants: { id: number; display_name: string }[];
  hostId: number;
  question: { question: string; options: string[]; correct: number } | null;
}

export default function QuizBattle({ notebookId, userId, pageId, onClose }: { notebookId: number; userId: number; pageId?: number; onClose: () => void }) {
  const token = typeof window !== "undefined" ? localStorage.getItem("studynest_token") || "" : "";
  const [state, setState] = useState<QBState | null>(null);
  const [answered, setAnswered] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("join_quiz_battle", { token, notebook_id: notebookId });

    socket.on("qb_state", (s: QBState) => { setState(s); setTotal(s.participants.length); });
    socket.on("qb_user_joined", (d: { user: any }) => setState((prev) => prev ? { ...prev, participants: prev.participants.some((p) => p.id === d.user.id) ? prev.participants : [...prev.participants, d.user] } : prev));
    socket.on("qb_user_left", (d: { user_id: number }) => setState((prev) => prev ? { ...prev, participants: prev.participants.filter((p) => p.id !== d.user_id) } : prev));
    socket.on("qb_question", (d: { question: any; index: number; total: number; scores: any }) => {
      setState((prev) => prev ? { ...prev, active: true, currentQ: d.index, question: d.question, scores: d.scores } : prev);
      setAnswered(null); setTotal(d.total);
    });
    socket.on("qb_scores", (d: { scores: any }) => setState((prev) => prev ? { ...prev, scores: d.scores } : prev));
    socket.on("qb_ended", (d: { scores: any }) => { setState((prev) => prev ? { ...prev, active: false, scores: d.scores } : prev); setEnded(true); });

    return () => {
      socket.emit("leave_quiz_battle", { notebook_id: notebookId });
      socket.off("qb_state"); socket.off("qb_user_joined"); socket.off("qb_user_left");
      socket.off("qb_question"); socket.off("qb_scores"); socket.off("qb_ended");
    };
  }, [notebookId]);

  const startBattle = async () => {
    if (!pageId) return;
    setLoading(true);
    try {
      const res = await api.post<{ questions: any[]; notebook_id: number }>("/ai/quiz", { page_id: pageId, count: 5 });
      const questions = res.data.questions;
      if (!questions) return;
      getSocket().emit("qb_start", { token, notebook_id: notebookId, questions });
    } catch {} finally { setLoading(false); }
  };

  const answer = (idx: number) => {
    if (answered !== null) return;
    setAnswered(idx);
    getSocket().emit("qb_answer", { token, notebook_id: notebookId, answer: idx });
  };

  const nextQ = () => getSocket().emit("qb_next", { token, notebook_id: notebookId });

  const isHost = state?.hostId === userId;
  const sortedScores = state ? Object.entries(state.scores).sort(([, a], [, b]) => b.points - a.points) : [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>⚡ Quiz Battle</h2>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        {!state && <div className="muted"><span className="spinner" /> Joining battle room…</div>}

        {state && !state.active && !ended && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Participants ({state.participants.length})</div>
              {state.participants.map((p) => (
                <div key={p.id} style={{ padding: "4px 0", fontSize: 14 }}>
                  {p.display_name} {p.id === state.hostId ? "👑" : ""}
                </div>
              ))}
            </div>
            {isHost && pageId && (
              <button className="btn btn-primary" onClick={startBattle} disabled={loading || state.participants.length < 1}>
                {loading ? "Generating questions…" : "🚀 Start Battle"}
              </button>
            )}
            {!isHost && <div className="muted" style={{ fontSize: 13 }}>Waiting for host to start…</div>}
            {isHost && !pageId && <div className="muted" style={{ fontSize: 13 }}>Open from a page to start a battle with AI-generated questions.</div>}
          </div>
        )}

        {state && state.active && state.question && (
          <div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Question {state.currentQ + 1} of {total}</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>{state.question.question}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {state.question.options.map((opt, i) => {
                let bg = "var(--surface-soft)";
                let border = "var(--border)";
                if (answered !== null) {
                  if (i === answered) { bg = "var(--accent-soft)"; border = "var(--accent)"; }
                }
                return (
                  <div key={i} onClick={() => answer(i)} style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${border}`, background: bg, cursor: answered === null ? "pointer" : "default", fontSize: 14 }}>
                    {opt}
                  </div>
                );
              })}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Live Scores</div>
              {sortedScores.map(([uid, s]) => (
                <div key={uid} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
                  <span>{s.display_name}</span>
                  <span style={{ fontWeight: 700, color: "var(--accent)" }}>{s.points} pts</span>
                </div>
              ))}
            </div>
            {isHost && answered !== null && (
              <button className="btn btn-primary" onClick={nextQ}>Next →</button>
            )}
          </div>
        )}

        {ended && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, textAlign: "center" }}>🏆 Final Results</div>
            {sortedScores.map(([uid, s], i) => (
              <div key={uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 20 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                <span style={{ flex: 1, fontWeight: 600 }}>{s.display_name}</span>
                <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: 18 }}>{s.points} pts</span>
              </div>
            ))}
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
