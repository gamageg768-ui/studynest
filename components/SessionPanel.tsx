"use client";
import { useAuth } from "@/contexts/AuthContext";

interface Participant { id: number; display_name: string; }

export default function SessionPanel({ participants }: { participants: Participant[] }) {
  const { user } = useAuth();
  if (participants.length === 0) return null;

  return (
    <div className="session-bar">
      <span className="session-live-dot" />
      <div className="session-avatars">
        {participants.slice(0, 6).map((p) => (
          <div key={p.id} className="session-avatar" title={p.display_name + (p.id === user?.id ? " (you)" : "")}>
            {p.display_name[0].toUpperCase()}
          </div>
        ))}
        {participants.length > 6 && (
          <div className="session-avatar session-avatar-more">+{participants.length - 6}</div>
        )}
      </div>
      <span className="session-label">
        {participants.length === 1
          ? participants[0].id === user?.id
            ? "Only you in this session"
            : `${participants[0].display_name} is here`
          : `${participants.length} people in session`}
      </span>
    </div>
  );
}
