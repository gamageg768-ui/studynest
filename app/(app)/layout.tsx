"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSession } from "@/contexts/SessionContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import Sidebar from "@/components/Sidebar";
import ChatPanel from "@/components/ChatPanel";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";

function useNotebookIdFromUrl(): number | null {
  const pathname = usePathname();
  const m = pathname.match(/\/notebooks\/(\d+)/);
  return m ? Number(m[1]) : null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { messages } = useSession();
  const { toggleTheme } = useTheme();
  const notebookId = useNotebookIdFromUrl();
  const [chatOpen, setChatOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const router = useRouter();

  const lastSeenCount = useState(() => messages.length)[0];
  const unread = chatOpen ? 0 : Math.max(0, messages.length - lastSeenCount);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const shortcuts = useCallback(() => ({
    "?": () => setShowShortcuts(true),
    "Shift+?": () => setShowShortcuts(true),
    "Ctrl+B": () => router.push("/dashboard"),
    "Ctrl+Shift+N": () => window.dispatchEvent(new CustomEvent("studynest:new-notebook")),
    "Ctrl+Shift+F": () => toggleTheme(),
    "Ctrl+K": () => {
      const el = document.querySelector<HTMLInputElement>(".sidebar-search");
      el?.focus();
    },
    "Escape": () => setShowShortcuts(false),
  }), [router, toggleTheme]);

  useKeyboardShortcuts(shortcuts());

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <span className="spinner" /> Loading...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        {user?.is_guest && (
          <div className="guest-banner">
            You&apos;re browsing as a guest — your data won&apos;t be saved permanently.{" "}
            <Link href="/register">Create a free account</Link> to keep your work.
          </div>
        )}
        {children}
      </main>

      {notebookId !== null && (
        <>
          <button
            className={`chat-fab ${chatOpen ? "chat-fab-active" : ""}`}
            onClick={() => setChatOpen((o) => !o)}
            title="Group chat"
          >
            💬
            {unread > 0 && <span className="chat-fab-badge">{unread}</span>}
          </button>
          {chatOpen && <ChatPanel notebookId={notebookId} onClose={() => setChatOpen(false)} />}
        </>
      )}

      {showShortcuts && <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
