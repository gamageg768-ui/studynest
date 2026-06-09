import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { notebookApi, pageApi } from "../api/client";
import type { Notebook, SearchResult } from "../api/types";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const [owned, setOwned] = useState<Notebook[]>([]);
  const [shared, setShared] = useState<Notebook[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    notebookApi
      .list()
      .then(({ owned, shared }) => {
        setOwned(owned);
        setShared(shared);
      })
      .catch(() => {});
    const handler = () => {
      notebookApi.list().then(({ owned, shared }) => {
        setOwned(owned);
        setShared(shared);
      });
    };
    window.addEventListener("studynest:refresh", handler);
    return () => window.removeEventListener("studynest:refresh", handler);
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      pageApi.search(search).then(setResults).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const initials = (user?.display_name || user?.username || "?")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="sidebar">
      <Link to="/" className="sidebar-brand" style={{ color: "inherit" }}>
        <span style={{ fontSize: 22 }}>📒</span>
        <span>StudyNest</span>
      </Link>

      <input
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
              onClick={() => {
                navigate(`/notebooks/${r.notebook_id}/pages/${r.id}`);
                setSearch("");
              }}
            >
              <span>{r.notebook_icon}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {!search && (
        <>
          <NavLink to="/" className="sidebar-link" end>
            🏠 Dashboard
          </NavLink>

          <div className="sidebar-section-title">My Notebooks</div>
          {owned.length === 0 && (
            <div className="muted" style={{ padding: "0 10px", fontSize: 13 }}>
              No notebooks yet
            </div>
          )}
          {owned.map((nb) => (
            <NavLink
              key={nb.id}
              to={`/notebooks/${nb.id}`}
              className={({ isActive }) =>
                "sidebar-link" + (isActive ? " active" : "")
              }
            >
              <span>{nb.icon}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {nb.title}
              </span>
            </NavLink>
          ))}

          {shared.length > 0 && (
            <>
              <div className="sidebar-section-title">Shared with me</div>
              {shared.map((nb) => (
                <NavLink
                  key={nb.id}
                  to={`/notebooks/${nb.id}`}
                  className={({ isActive }) =>
                    "sidebar-link" + (isActive ? " active" : "")
                  }
                >
                  <span>{nb.icon}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {nb.title}
                  </span>
                </NavLink>
              ))}
            </>
          )}
        </>
      )}

      <div className="sidebar-user">
        <div className="avatar">{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user?.display_name}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            @{user?.username}
          </div>
        </div>
        <button
          className="btn btn-ghost"
          title="Log out"
          onClick={() => logout().then(() => navigate("/login"))}
        >
          ⎋
        </button>
      </div>
    </aside>
  );
}
