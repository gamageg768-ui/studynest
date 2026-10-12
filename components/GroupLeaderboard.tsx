"use client";
import { useEffect, useState } from "react";
import { groupApi } from "@/lib/client";

interface LeaderRow {
  user_id: number;
  display_name: string;
  study_seconds: number;
  cards_reviewed: number;
  quiz_avg: number | null;
  points: number;
}

function medal(rank: number) {
  if (rank === 0) return "🥇";
  if (rank === 1) return "🥈";
  if (rank === 2) return "🥉";
  return `${rank + 1}.`;
}

function fmt(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function GroupLeaderboard({ notebookId, onClose }: { notebookId: number; onClose: () => void }) {
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"points" | "study" | "quiz">("points");

  useEffect(() => {
    groupApi.leaderboard(notebookId).then(setRows).finally(() => setLoading(false));
  }, [notebookId]);

  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "study") return b.study_seconds - a.study_seconds;
    if (sortBy === "quiz") return (b.quiz_avg ?? -1) - (a.quiz_avg ?? -1);
    return b.points - a.points;
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <h2>🏆 Group Leaderboard</h2>
        <div className="flex gap-2" style={{ marginBottom: 16 }}>
          {(["points", "study", "quiz"] as const).map((k) => (
            <button key={k} className={`btn ${sortBy === k ? "btn-primary" : "btn-ghost"}`} style={{ fontSize: 12 }} onClick={() => setSortBy(k)}>
              {k === "points" ? "Overall" : k === "study" ? "Study time" : "Quiz avg"}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="muted"><span className="spinner" /> Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="muted">No data yet. Start studying!</div>
        ) : (
          <div>
            {sorted.map((r, i) => (
              <div key={r.user_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 20, width: 32, textAlign: "center" }}>{medal(i)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{r.display_name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {fmt(r.study_seconds)} studied · {r.cards_reviewed} cards · {r.quiz_avg !== null ? `${r.quiz_avg}% quiz` : "no quizzes"}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: "var(--accent)", fontSize: 18 }}>
                  {sortBy === "points" ? `${r.points}pts` : sortBy === "study" ? fmt(r.study_seconds) : r.quiz_avg !== null ? `${r.quiz_avg}%` : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
