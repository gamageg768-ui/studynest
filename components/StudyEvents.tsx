"use client";
import { useEffect, useState } from "react";
import { studyEventApi } from "@/lib/client";

interface StudyEvent {
  id: number;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  agenda: string;
  creator_name: string;
}

function fmtDateTime(ts: string) {
  return new Date(ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function StudyEvents({ notebookId, canCreate, onClose }: { notebookId: number; canCreate: boolean; onClose: () => void }) {
  const [events, setEvents] = useState<StudyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(60);
  const [agenda, setAgenda] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = () => {
    studyEventApi.list(notebookId).then(setEvents).finally(() => setLoading(false));
  };

  useEffect(refresh, [notebookId]);

  const save = async () => {
    if (!title.trim() || !scheduledAt) return;
    setSaving(true); setError("");
    try {
      await studyEventApi.create(notebookId, { title: title.trim(), scheduled_at: scheduledAt, duration_minutes: duration, agenda: agenda.trim() });
      setTitle(""); setScheduledAt(""); setDuration(60); setAgenda("");
      setCreating(false);
      refresh();
    } catch (e: any) {
      setError(e.message || "Failed to create event");
    } finally {
      setSaving(false);
    }
  };

  const upcoming = events.filter((e) => new Date(e.scheduled_at) >= new Date());
  const past = events.filter((e) => new Date(e.scheduled_at) < new Date());

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>📅 Study Sessions</h2>
          {canCreate && !creating && (
            <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setCreating(true)}>+ Schedule</button>
          )}
        </div>

        {creating && (
          <div style={{ background: "var(--surface-soft)", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input className="input" placeholder="Session title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <input className="input" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              <div className="flex gap-2" style={{ alignItems: "center" }}>
                <label style={{ fontSize: 13, whiteSpace: "nowrap" }}>Duration:</label>
                <input className="input" type="number" min={15} max={480} value={duration} onChange={(e) => setDuration(Number(e.target.value))} style={{ width: 80 }} />
                <span style={{ fontSize: 13 }}>min</span>
              </div>
              <textarea className="input" placeholder="Agenda (optional)" value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={2} style={{ resize: "vertical" }} />
              {error && <div className="error-banner">{error}</div>}
              <div className="flex gap-2">
                <button className="btn btn-primary" onClick={save} disabled={saving || !title.trim() || !scheduledAt}>{saving ? "Saving…" : "Schedule"}</button>
                <button className="btn btn-ghost" onClick={() => { setCreating(false); setError(""); }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="muted"><span className="spinner" /> Loading…</div>
        ) : (
          <div>
            {upcoming.length === 0 && !creating && <div className="muted" style={{ marginBottom: 12 }}>No upcoming sessions scheduled.</div>}
            {upcoming.map((ev) => (
              <div key={ev.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{ev.title}</div>
                <div className="muted" style={{ fontSize: 13 }}>📅 {fmtDateTime(ev.scheduled_at)} · ⏱ {ev.duration_minutes}min · by {ev.creator_name}</div>
                {ev.agenda && <div style={{ fontSize: 13, marginTop: 4, color: "var(--text-muted)" }}>{ev.agenda}</div>}
              </div>
            ))}
            {past.length > 0 && (
              <details style={{ marginTop: 12 }}>
                <summary className="muted" style={{ cursor: "pointer", fontSize: 13 }}>Past sessions ({past.length})</summary>
                {past.map((ev) => (
                  <div key={ev.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", opacity: 0.6 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{ev.title}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{fmtDateTime(ev.scheduled_at)} · {ev.duration_minutes}min</div>
                  </div>
                ))}
              </details>
            )}
          </div>
        )}
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
