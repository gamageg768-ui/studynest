import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import ChatPanel from "./ChatPanel";
import { useAuth } from "../context/AuthContext";
import { useSession } from "../context/SessionContext";

function useNotebookIdFromUrl(): number | null {
  const { pathname } = useLocation();
  const m = pathname.match(/\/notebooks\/(\d+)/);
  return m ? Number(m[1]) : null;
}

export default function Layout() {
  const { user } = useAuth();
  const { messages } = useSession();
  const notebookId = useNotebookIdFromUrl();
  const [chatOpen, setChatOpen] = useState(false);

  // Count unread: messages received while chat is closed
  const lastSeenCount = useState(() => messages.length)[0];
  const unread = chatOpen ? 0 : Math.max(0, messages.length - lastSeenCount);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        {user?.is_guest && (
          <div className="guest-banner">
            You're browsing as a guest — your data won't be saved permanently.{" "}
            <Link to="/register">Create a free account</Link> to keep your work.
          </div>
        )}
        <Outlet />
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

          {chatOpen && (
            <ChatPanel
              notebookId={notebookId}
              onClose={() => setChatOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
