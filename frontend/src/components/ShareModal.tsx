import { useEffect, useState } from "react";
import { shareApi, getErrorMessage } from "../api/client";
import type { Share } from "../api/types";

export default function ShareModal({
  notebookId,
  onClose,
}: {
  notebookId: number;
  onClose: () => void;
}) {
  const [shares, setShares] = useState<Share[]>([]);
  const [username, setUsername] = useState("");
  const [permission, setPermission] = useState<"read" | "edit">("read");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = () => {
    shareApi.list(notebookId).then(setShares).catch(() => {});
  };

  useEffect(refresh, [notebookId]);

  const add = async () => {
    setError("");
    if (!username.trim()) return;
    setLoading(true);
    try {
      await shareApi.add(notebookId, username.trim(), permission);
      setUsername("");
      refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const remove = async (shareId: number) => {
    try {
      await shareApi.remove(notebookId, shareId);
      refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Share notebook</h2>
        <p>Invite friends or classmates by their StudyNest username.</p>

        {error && <div className="error-banner">{error}</div>}

        <div className="modal-form">
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="friend's username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <select
              className="input"
              style={{ maxWidth: 110 }}
              value={permission}
              onChange={(e) => setPermission(e.target.value as "read" | "edit")}
            >
              <option value="read">Read</option>
              <option value="edit">Edit</option>
            </select>
            <button className="btn btn-primary" onClick={add} disabled={loading}>
              Invite
            </button>
          </div>

          {shares.length > 0 && (
            <ul className="share-list">
              {shares.map((s) => (
                <li key={s.id}>
                  <div>
                    <strong>{s.display_name}</strong>{" "}
                    <span className="muted">@{s.username}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="tag">
                      {s.permission === "edit" ? "✏️ edit" : "👀 read"}
                    </span>
                    <button
                      className="btn btn-ghost"
                      onClick={() => remove(s.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
