"use client";
import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSession } from "@/contexts/SessionContext";
import type { ChatMessage } from "@/contexts/SessionContext";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🔥", "👏", "🤔"];

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderWithMentions(text: string) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((p, i) =>
    /^@\w+$/.test(p)
      ? <strong key={i} style={{ color: "var(--accent)" }}>{p}</strong>
      : <span key={i}>{p}</span>
  );
}

function ReactionBar({ msg, userId, onAdd, onRemove }: { msg: ChatMessage; userId: number; onAdd: (emoji: string) => void; onRemove: (emoji: string) => void }) {
  const [showPicker, setShowPicker] = useState(false);
  const reactions = msg.reactions ?? {};
  const hasReactions = Object.keys(reactions).length > 0;

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
      {Object.values(reactions).map((r) => {
        const mine = r.users.some((u) => u.user_id === userId);
        return (
          <button
            key={r.emoji}
            title={r.users.map((u) => u.display_name).join(", ")}
            onClick={() => mine ? onRemove(r.emoji) : onAdd(r.emoji)}
            style={{ background: mine ? "var(--accent-soft)" : "var(--surface-soft)", border: `1px solid ${mine ? "var(--accent)" : "var(--border)"}`, borderRadius: 12, padding: "1px 6px", fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}
          >
            {r.emoji} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.users.length}</span>
          </button>
        );
      })}
      <button
        onClick={() => setShowPicker((p) => !p)}
        style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 12, padding: "1px 5px", fontSize: 11, cursor: "pointer", color: "var(--text-muted)" }}
        title="Add reaction"
      >
        + 😊
      </button>
      {showPicker && (
        <div style={{ position: "absolute", bottom: "100%", left: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 6, display: "flex", gap: 4, zIndex: 50, boxShadow: "var(--shadow)" }}>
          {QUICK_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => { onAdd(e); setShowPicker(false); }}
              style={{ background: "transparent", border: "none", fontSize: 16, cursor: "pointer", padding: 2, borderRadius: 4 }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, isMine, userId, onAddReaction, onRemoveReaction }: { msg: ChatMessage; isMine: boolean; userId: number; onAddReaction: (emoji: string) => void; onRemoveReaction: (emoji: string) => void }) {
  return (
    <div className={`chat-msg ${isMine ? "chat-msg-mine" : ""}`}>
      {!isMine && <div className="chat-sender">{msg.display_name}</div>}
      <div className="chat-bubble">{renderWithMentions(msg.message)}</div>
      <div className="chat-time">{formatTime(msg.created_at)}</div>
      <ReactionBar msg={msg} userId={userId} onAdd={onAddReaction} onRemove={onRemoveReaction} />
    </div>
  );
}

export default function ChatPanel({ notebookId, onClose }: { notebookId: number; onClose: () => void }) {
  const { user } = useAuth();
  const { messages, typingUsers, sendMessage, emitTypingStart, emitTypingStop, addReaction, removeReaction } = useSession();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleInput = (value: string) => {
    setInput(value);
    emitTypingStart(notebookId);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTypingStop(notebookId), 2000);
  };

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    emitTypingStop(notebookId);
    sendMessage(notebookId, text);
    setInput("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const otherTyping = Object.entries(typingUsers)
    .filter(([uid]) => Number(uid) !== user?.id)
    .map(([, name]) => name);

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-title">
          <span className="session-live-dot" />
          <span>Notebook Chat</span>
        </div>
        <button className="btn btn-ghost" onClick={onClose} title="Close (Esc)">✕</button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && <div className="chat-empty">No messages yet. Say hello!</div>}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isMine={msg.user_id === user?.id}
            userId={user?.id ?? 0}
            onAddReaction={(emoji) => addReaction(msg.id, emoji)}
            onRemoveReaction={(emoji) => removeReaction(msg.id, emoji)}
          />
        ))}
        {otherTyping.length > 0 && (
          <div className="muted" style={{ fontSize: 12, fontStyle: "italic", padding: "4px 0" }}>
            {otherTyping.join(", ")} {otherTyping.length === 1 ? "is" : "are"} typing…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <input
          className="input"
          value={input}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message… (Enter to send, @mention)"
          autoFocus
        />
        <button className="btn btn-primary" onClick={submit} disabled={!input.trim()}>Send</button>
      </div>
    </div>
  );
}
