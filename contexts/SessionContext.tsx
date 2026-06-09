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
}

interface SessionContextValue {
  participants: Participant[];
  messages: ChatMessage[];
  joinSession: (notebookId: number) => void;
  leaveSession: (notebookId: number) => void;
  emitPageUpdate: (notebookId: number, pageId: number, title: string, content: string) => void;
  sendMessage: (notebookId: number, message: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
      setMessages(data.messages ?? []);
    });

    socket.on("user_joined", (data: { user: Participant }) => {
      setParticipants((prev) =>
        prev.some((p) => p.id === data.user.id) ? prev : [...prev, data.user]
      );
    });

    socket.on("user_left", (data: { user: Participant }) => {
      setParticipants((prev) => prev.filter((p) => p.id !== data.user.id));
    });

    socket.on("page_updated", (data: unknown) => {
      window.dispatchEvent(new CustomEvent("studynest:page_updated", { detail: data }));
    });

    socket.on("new_message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off("session_state");
      socket.off("user_joined");
      socket.off("user_left");
      socket.off("page_updated");
      socket.off("new_message");
    };
  }, []);

  const joinSession = useCallback((notebookId: number) => {
    const prev = joinCounts.current[notebookId] ?? 0;
    joinCounts.current[notebookId] = prev + 1;
    if (prev === 0) {
      setParticipants([]);
      setMessages([]);
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

  return (
    <SessionContext.Provider value={{ participants, messages, joinSession, leaveSession, emitPageUpdate, sendMessage }}>
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
  const { participants, messages, joinSession, leaveSession, emitPageUpdate, sendMessage } = useSession();

  useEffect(() => {
    joinSession(notebookId);
    return () => leaveSession(notebookId);
  }, [notebookId]);

  return { participants, messages, emitPageUpdate, sendMessage };
}
