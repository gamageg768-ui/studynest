"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { notebookApi, pageApi, api } from "@/lib/client";
import type { Notebook, SearchResult } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  data: string;
  is_read: 0 | 1;
  created_at: string;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = () => {
    api.get<{ notifications: Notification[]; unread_count: number }>("/notifications")
      .then(r => { setNotifs(r.data.notifications); setUnreadCount(r.data.unread_count); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifs();
    const id = setInterval(fetchNotifs, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAll = async () => {
    await api.patch("/notifications/read-all").catch(() => {});
    setNotifs(n => n.map(x => ({ ...x, is_read: 1 })));
    setUnreadCount(0);
  };

  const markOne = async (n: Notification) => {
    if (!n.is_read) {
      await api.patch(`/notifications/${n.id}/read`).catch(() => {});
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: 1 } : x));
      setUnreadCount(c => Math.max(0, c - 1));
    }
    try {
      const data = JSON.parse(n.data);
      if (data.notebook_id) router.push(`/notebooks/${data.notebook_id}`);
    } catch {}
    setOpen(false);
  };

  return (
    <div className="notif-bell-wrap" ref={wrapRef} style={{ position: "relative" }}>
      <button
        className="btn btn-ghost"
        title="Notifications"
        onClick={() => setOpen(o => !o)}
        style={{ fontSize: 16 }}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 6px" }} onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>
          {notifs.length === 0 ? (
            <div style={{ padding: "20px 14px", color: "var(--text-muted)", fontSize: 13 }}>No notifications yet</div>
          ) : (
            notifs.map(n => (
              <div
                key={n.id}
                className={`notif-item${n.is_read ? "" : " unread"}`}
                onClick={() => markOne(n)}
              >
                <div className="notif-title">{n.title}</div>
                <div className="notif-body">{n.body}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const [owned, setOwned] = useState<Notebook[]>([]);
  const [shared, setShared] = useState<Notebook[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    notebookApi.list().then(({ owned, shared }) => { setOwned(owned); setShared(shared); }).catch(() => {});
    const handler = () => {
      notebookApi.list().then(({ owned, shared }) => { setOwned(owned); setShared(shared); });
    };
    window.addEventListener("studynest:refresh", handler);
    // Focus search via keyboard shortcut
    const focusSearch = () => searchRef.current?.focus();
    window.addEventListener("studynest:focus-search", focusSearch);
    return () => {
      window.removeEventListener("studynest:refresh", handler);
      window.removeEventListener("studynest:focus-search", focusSearch);
    };
  }, []);

  // Fetch review badge count
  useEffect(() => {
    api.get<{ count: number }>("/review").then(r => setReviewCount(r.data.count)).catch(() => {});
    const id = setInterval(() => {
      api.get<{ count: number }>("/review").then(r => setReviewCount(r.data.count)).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      pageApi.search(search).then(setResults).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const initials = (user?.display_name || user?.username || "?").slice(0, 2).toUpperCase();

  const linkClass = (href: string, exact = false) => {
    const active = exact ? pathname === href : pathname.startsWith(href);
    return "sidebar-link" + (active ? " active" : "");
  };

  return (
    <aside className="sidebar">
      <Link href="/dashboard" className="sidebar-brand" style={{ color: "inherit" }}>
        <span style={{ fontSize: 22 }}>📒</span>
        <span>StudyNest</span>
      </Link>

      <input
        ref={searchRef}
        className="input sidebar-search"
        placeholder="Search notes..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {results.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="sidebar-section-title">Results</div>
          {results.map((r) => (
            <div
              key={r.id}
              className="sidebar-link"
              onClick={() => { router.push(`/notebooks/${r.notebook_id}/pages/${r.id}`); setSearch(""); }}
            >
              <span>{r.notebook_icon}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</span>
            </div>
          ))}
        </div>
      )}

      {!search && (
        <>
          <Link href="/dashboard" className={linkClass("/dashboard", true)}>
            🏠 Dashboard
          </Link>
          <Link href="/review" className={linkClass("/review", true)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>🃏 Review cards</span>
            {reviewCount > 0 && (
              <span style={{ background: "var(--danger)", color: "#fff", borderRadius: "999px", fontSize: 11, fontWeight: 700, padding: "1px 7px" }}>
                {reviewCount}
              </span>
            )}
          </Link>

          <div className="sidebar-section-title">My Notebooks</div>
          {owned.length === 0 && (
            <div className="muted" style={{ padding: "0 10px", fontSize: 13 }}>No notebooks yet</div>
          )}
          {owned.map((nb) => (
            <Link key={nb.id} href={`/notebooks/${nb.id}`} className={linkClass(`/notebooks/${nb.id}`)}>
              <span>{nb.icon}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{nb.title}</span>
            </Link>
          ))}

          {shared.length > 0 && (
            <>
              <div className="sidebar-section-title">Shared with me</div>
              {shared.map((nb) => (
                <Link key={nb.id} href={`/notebooks/${nb.id}`} className={linkClass(`/notebooks/${nb.id}`)}>
                  <span>{nb.icon}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{nb.title}</span>
                </Link>
              ))}
            </>
          )}
        </>
      )}

      <div className="sidebar-user">
        <div className="avatar">{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user?.display_name}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>@{user?.username}</div>
        </div>
        <NotificationBell />
        <button className="btn btn-ghost" title={theme === "dark" ? "Light mode" : "Dark mode"} onClick={toggleTheme} style={{ fontSize: 16 }}>
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
        <Link href="/settings" className="btn btn-ghost" title="Settings" style={{ fontSize: 16 }}>
          ⚙️
        </Link>
        <button className="btn btn-ghost" title="Log out" onClick={() => logout().then(() => router.push("/login"))}>
          ⎋
        </button>
      </div>
    </aside>
  );
}
