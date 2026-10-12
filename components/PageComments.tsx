"use client";
import { useEffect, useState } from "react";
import { commentApi } from "@/lib/client";
import { useAuth } from "@/contexts/AuthContext";

interface Comment {
  id: number;
  user_id: number;
  display_name: string;
  anchor_text: string;
  body: string;
  resolved: 0 | 1;
  created_at: string;
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PageComments({ pageId, canResolve }: { pageId: number; canResolve: boolean }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const refresh = () => { commentApi.list(pageId).then(setComments).catch(() => {}); };
  useEffect(refresh, [pageId]);

  const submit = async () => {
    const text = body.trim();
    if (!text) return;
    setSaving(true);
    try {
      const c = await commentApi.create(pageId, text);
      setComments((prev) => [...prev, c]);
      setBody("");
    } catch {} finally { setSaving(false); }
  };

  const resolve = async (id: number) => {
    try {
      await commentApi.resolve(id);
      setComments((prev) => prev.map((c) => c.id === id ? { ...c, resolved: 1 } : c));
    } catch {}
  };

  const active = comments.filter((c) => !c.resolved);
  const resolved = comments.filter((c) => c.resolved);

  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 24, paddingTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <strong style={{ fontSize: 14 }}>💬 Comments ({active.length})</strong>
        {resolved.length > 0 && (
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowResolved((s) => !s)}>
            {showResolved ? "Hide" : "Show"} resolved ({resolved.length})
          </button>
        )}
      </div>

      {active.length === 0 && !showResolved && (
        <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>No comments yet.</div>
      )}

      {active.map((c) => (
        <div key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{c.display_name}</span>
            <span className="muted" style={{ fontSize: 11 }}>{fmtDate(c.created_at)}</span>
          </div>
          {c.anchor_text && (
            <div style={{ fontSize: 12, background: "var(--surface-soft)", borderLeft: "3px solid var(--accent)", padding: "3px 8px", marginBottom: 4, fontStyle: "italic", color: "var(--text-muted)" }}>
              "{c.anchor_text}"
            </div>
          )}
          <div style={{ fontSize: 14 }}>{c.body}</div>
          {(canResolve || c.user_id === user?.id) && (
            <button className="btn btn-ghost" style={{ fontSize: 11, marginTop: 4, color: "var(--text-muted)" }} onClick={() => resolve(c.id)}>✓ Resolve</button>
          )}
        </div>
      ))}

      {showResolved && resolved.map((c) => (
        <div key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", opacity: 0.5 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 600, fontSize: 12 }}>{c.display_name}</span>
            <span className="muted" style={{ fontSize: 11 }}>✓ resolved</span>
          </div>
          <div style={{ fontSize: 13 }}>{c.body}</div>
        </div>
      ))}

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <input
          className="input"
          placeholder="Add a comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={submit} disabled={saving || !body.trim()}>Post</button>
      </div>
    </div>
  );
}
