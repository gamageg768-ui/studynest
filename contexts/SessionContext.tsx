"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { getSocket } from "@/lib/socket";

export interface Participant {
  id: number;
  display_name: string;
}

export interface ChatMessage {
  id: number;
  user_id: number;
  display_name: string;
  message: string;
  created_at: string;
  reactions?: Record<string, { emoji: string; users: { user_id: number; display_name: string }[] }>;
}

interface SessionContextValue {
  participants: Participant[];
  messages: ChatMessage[];
  typingUsers: Record<number, string>;
  joinSession: (notebookId: number) => void;
  leaveSession: (notebookId: number) => void;
  emitPageUpdate: (notebookId: number, pageId: number, title: string, content: string) => void;
  sendMessage: (notebookId: number, message: string) => void;
  emitTypingStart: (notebookId: number) => void;
  emitTypingStop: (notebookId: number) => void;
  addReaction: (messageId: number, emoji: string) => void;
  removeReaction: (messageId: number, emoji: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<number, string>>({});
  const joinCounts = useRef<Record<number, number>>({});

  useEffect(() => {
    const socket = getSocket();

    socket.on("session_state", (data: { participants: Participant[]; messages: ChatMessage[] }) => {
      const seen = new Set<number>();
      setParticipants(
        data.participants.filter((p) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        })
      );
      setMessages((data.messages ?? []).map((m) => ({ ...m, reactions: m.reactions ?? {} })));
    });

    socket.on("user_joined", (data: { user: Participant }) => {
      setParticipants((prev) =>
        prev.some((p) => p.id === data.user.id) ? prev : [...prev, data.user]
      );
    });

    socket.on("user_left", (data: { user: Participant }) => {
      setParticipants((prev) => prev.filter((p) => p.id !== data.user.id));
      setTypingUsers((prev) => { const n = { ...prev }; delete n[data.user.id]; return n; });
    });

    socket.on("page_updated", (data: unknown) => {
      window.dispatchEvent(new CustomEvent("studynest:page_updated", { detail: data }));
    });

    socket.on("new_message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, { ...msg, reactions: msg.reactions ?? {} }]);
    });

    socket.on("typing_user", (data: { user_id: number; display_name: string }) => {
      setTypingUsers((prev) => ({ ...prev, [data.user_id]: data.display_name }));
    });

    socket.on("typing_clear", (data: { user_id: number }) => {
      setTypingUsers((prev) => { const n = { ...prev }; delete n[data.user_id]; return n; });
    });

    socket.on("reaction_added", (data: { message_id: number; emoji: string; user_id: number; display_name: string }) => {
      setMessages((prev) => prev.map((m) => {
        if (m.id !== data.message_id) return m;
        const reactions = { ...(m.reactions ?? {}) };
        if (!reactions[data.emoji]) reactions[data.emoji] = { emoji: data.emoji, users: [] };
        if (!reactions[data.emoji].users.some((u) => u.user_id === data.user_id)) {
          reactions[data.emoji] = { ...reactions[data.emoji], users: [...reactions[data.emoji].users, { user_id: data.user_id, display_name: data.display_name }] };
        }
        return { ...m, reactions };
      }));
    });

    socket.on("reaction_removed", (data: { message_id: number; emoji: string; user_id: number }) => {
      setMessages((prev) => prev.map((m) => {
        if (m.id !== data.message_id) return m;
        const reactions = { ...(m.reactions ?? {}) };
        if (reactions[data.emoji]) {
          reactions[data.emoji] = { ...reactions[data.emoji], users: reactions[data.emoji].users.filter((u) => u.user_id !== data.user_id) };
          if (reactions[data.emoji].users.length === 0) delete reactions[data.emoji];
        }
        return { ...m, reactions };
      }));
    });

    return () => {
      socket.off("session_state");
      socket.off("user_joined");
      socket.off("user_left");
      socket.off("page_updated");
      socket.off("new_message");
      socket.off("typing_user");
      socket.off("typing_clear");
      socket.off("reaction_added");
      socket.off("reaction_removed");
    };
  }, []);

  const joinSession = useCallback((notebookId: number) => {
    const prev = joinCounts.current[notebookId] ?? 0;
    joinCounts.current[notebookId] = prev + 1;
    if (prev === 0) {
      setParticipants([]);
      setMessages([]);
      setTypingUsers({});
      const token = localStorage.getItem("studynest_token") ?? "";
      getSocket().emit("join_session", { notebook_id: notebookId, token });
    }
  }, []);

  const leaveSession = useCallback((notebookId: number) => {
    joinCounts.current[notebookId] = Math.max(0, (joinCounts.current[notebookId] ?? 0) - 1);
    setTimeout(() => {
      if ((joinCounts.current[notebookId] ?? 0) === 0) {
        getSocket().emit("leave_session", { notebook_id: notebookId });
        setParticipants([]);
        setMessages([]);
        setTypingUsers({});
        delete joinCounts.current[notebookId];
      }
    }, 0);
  }, []);

  const emitPageUpdate = useCallback(
    (notebookId: number, pageId: number, title: string, content: string) => {
      const token = localStorage.getItem("studynest_token") ?? "";
      getSocket().emit("page_update", { notebook_id: notebookId, page_id: pageId, title, content, token });
    },
    []
  );

  const sendMessage = useCallback((notebookId: number, message: string) => {
    const token = localStorage.getItem("studynest_token") ?? "";
    getSocket().emit("send_message", { notebook_id: notebookId, message, token });
  }, []);

  const emitTypingStart = useCallback((notebookId: number) => {
    const token = localStorage.getItem("studynest_token") ?? "";
    getSocket().emit("typing_start", { notebook_id: notebookId, token });
  }, []);

  const emitTypingStop = useCallback((notebookId: number) => {
    const token = localStorage.getItem("studynest_token") ?? "";
    getSocket().emit("typing_stop", { notebook_id: notebookId, token });
  }, []);

  const addReaction = useCallback((messageId: number, emoji: string) => {
    const token = localStorage.getItem("studynest_token") ?? "";
    getSocket().emit("add_reaction", { message_id: messageId, emoji, token });
  }, []);

  const removeReaction = useCallback((messageId: number, emoji: string) => {
    const token = localStorage.getItem("studynest_token") ?? "";
    getSocket().emit("remove_reaction", { message_id: messageId, emoji, token });
  }, []);

  return (
    <SessionContext.Provider value={{ participants, messages, typingUsers, joinSession, leaveSession, emitPageUpdate, sendMessage, emitTypingStart, emitTypingStop, addReaction, removeReaction }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

export function useNotebookSession(notebookId: number) {
  const { participants, messages, typingUsers, joinSession, leaveSession, emitPageUpdate, sendMessage } = useSession();

  useEffect(() => {
    joinSession(notebookId);
    return () => leaveSession(notebookId);
  }, [notebookId]);

  return { participants, messages, typingUsers, emitPageUpdate, sendMessage };
}
