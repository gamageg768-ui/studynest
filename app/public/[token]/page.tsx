"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { api } from "@/lib/client";

interface PublicPage { id: number; title: string; content: string; updated_at: string; }
interface PublicNotebook { id: number; title: string; description: string; color: string; icon: string; owner_name: string; }

export default function PublicNotebookPage() {
  const { token } = useParams() as { token: string };
  const [nb, setNb] = useState<PublicNotebook | null>(null);
  const [pages, setPages] = useState<PublicPage[]>([]);
  const [activePage, setActivePage] = useState<PublicPage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<{ notebook: PublicNotebook; pages: PublicPage[] }>(`/public/${token}`)
      .then((r) => { setNb(r.data.notebook); setPages(r.data.pages); if (r.data.pages[0]) setActivePage(r.data.pages[0]); })
      .catch(() => setError("This link is invalid or has expired."));
  }, [token]);

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <div style={{ fontWeight: 600 }}>{error}</div>
    </div>
  );
  if (!nb) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><span className="spinner" /></div>;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #f9fafb)" }}>
      <div style={{ background: nb.color || "#fef3c7", padding: "20px 32px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 36 }}>{nb.icon}</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{nb.title}</h1>
            {nb.description && <p style={{ margin: "4px 0 0", opacity: 0.7, fontSize: 14 }}>{nb.description}</p>}
            <p style={{ margin: "2px 0 0", opacity: 0.5, fontSize: 12 }}>Shared by {nb.owner_name} · read-only</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 32px", display: "grid", gridTemplateColumns: "200px 1fr", gap: 24 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, opacity: 0.5 }}>Pages</div>
          {pages.map((p) => (
            <div key={p.id} onClick={() => setActivePage(p)} style={{ padding: "8px 10px", borderRadius: 6, cursor: "pointer", background: activePage?.id === p.id ? "rgba(99,102,241,0.1)" : "transparent", fontWeight: activePage?.id === p.id ? 600 : 400, fontSize: 14, marginBottom: 2 }}>
              {p.title}
            </div>
          ))}
        </div>
        <div>
          {activePage && (
            <>
              <h2 style={{ marginTop: 0 }}>{activePage.title}</h2>
              <div className="preview-content">
                <ReactMarkdown>{activePage.content || "*Empty page*"}</ReactMarkdown>
              </div>
              <div style={{ marginTop: 16, fontSize: 12, opacity: 0.4 }}>Last updated {new Date(activePage.updated_at).toLocaleString()}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
