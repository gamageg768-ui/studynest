"use client";
import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSession } from "@/contexts/SessionContext";
import type { ChatMessage } from "@/contexts/SessionContext";

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MessageBubble({ msg, isMine }: { msg: ChatMessage; isMine: boolean }) {
  return (
    <div className={`chat-msg ${isMine ? "chat-msg-mine" : ""}`}>
      {!isMine && <div className="chat-sender">{msg.display_name}</div>}
      <div className="chat-bubble">{msg.message}</div>
      <div className="chat-time">{formatTime(msg.created_at)}</div>
    </div>
  );
}

export default function ChatPanel({ notebookId, onClose }: { notebookId: number; onClose: () => void }) {
  const { user } = useAuth();
  const { messages, sendMessage } = useSession();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    sendMessage(notebookId, text);
    setInput("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

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
          <MessageBubble key={msg.id} msg={msg} isMine={msg.user_id === user?.id} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message… (Enter to send)"
          autoFocus
        />
        <button className="btn btn-primary" onClick={submit} disabled={!input.trim()}>Send</button>
      </div>
    </div>
  );
}
