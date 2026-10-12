"use client";
import { useEffect, useState } from "react";
import { shareApi, publicLinkApi, getErrorMessage } from "@/lib/client";
import type { Share } from "@/types";

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

export default function ShareModal({ notebookId, onClose }: { notebookId: number; onClose: () => void }) {
  const [shares, setShares] = useState<Share[]>([]);
  const [username, setUsername] = useState("");
  const [permission, setPermission] = useState<"read" | "edit" | "admin">("read");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = () => { shareApi.list(notebookId).then(setShares).catch(() => {}); };
  useEffect(() => {
    refresh();
    publicLinkApi.get(notebookId).then((link) => setPublicToken(link?.token ?? null)).catch(() => {});
  }, [notebookId]);

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
    try { await shareApi.remove(notebookId, shareId); refresh(); }
    catch (err) { setError(getErrorMessage(err)); }
  };

  const createLink = async () => {
    setLinkLoading(true);
    try {
      const token = await publicLinkApi.create(notebookId);
      setPublicToken(token);
    } catch {}
    finally { setLinkLoading(false); }
  };

  const revokeLink = async () => {
    try { await publicLinkApi.revoke(notebookId); setPublicToken(null); }
    catch {}
  };

  const publicUrl = publicToken ? `${window.location.origin}/public/${publicToken}` : null;

  const handleCopy = () => {
    if (publicUrl) { copyToClipboard(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const permissionLabel = (p: string) => {
    if (p === "admin") return "🛡️ admin";
    if (p === "edit") return "✏️ edit";
    return "👀 read";
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <h2>Share notebook</h2>
        {error && <div className="error-banner">{error}</div>}

        <div className="modal-form">
          <p style={{ margin: "0 0 12px", color: "var(--text-muted)", fontSize: 14 }}>Invite by username</p>
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
              style={{ maxWidth: 120 }}
              value={permission}
              onChange={(e) => setPermission(e.target.value as any)}
            >
              <option value="read">👀 Read</option>
              <option value="edit">✏️ Edit</option>
              <option value="admin">🛡️ Admin</option>
            </select>
            <button className="btn btn-primary" onClick={add} disabled={loading}>Invite</button>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
            Admin can manage shares and assign pages. Edit can create/modify pages. Read is view-only.
          </div>

          {shares.length > 0 && (
            <ul className="share-list" style={{ marginTop: 16 }}>
              {shares.map((s) => (
                <li key={s.id}>
                  <div><strong>{s.display_name}</strong> <span className="muted">@{s.username}</span></div>
                  <div className="flex gap-2">
                    <span className="tag">{permissionLabel(s.permission)}</span>
                    <button className="btn btn-ghost" onClick={() => remove(s.id)}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <p style={{ margin: "0 0 10px", fontWeight: 600, fontSize: 14 }}>🔗 Public link</p>
            <p style={{ margin: "0 0 10px", color: "var(--text-muted)", fontSize: 13 }}>Anyone with this link can view the notebook without an account.</p>
            {publicToken ? (
              <div>
                <div className="flex gap-2" style={{ marginBottom: 8 }}>
                  <input className="input" readOnly value={publicUrl ?? ""} style={{ fontSize: 12, flex: 1 }} />
                  <button className="btn btn-secondary" onClick={handleCopy}>{copied ? "✓ Copied" : "Copy"}</button>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 12, color: "var(--danger)" }} onClick={revokeLink}>Revoke link</button>
              </div>
            ) : (
              <button className="btn btn-secondary" onClick={createLink} disabled={linkLoading}>
                {linkLoading ? "Generating…" : "Generate public link"}
              </button>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
