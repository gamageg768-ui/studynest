"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { pageApi, notebookApi, api, getErrorMessage } from "@/lib/client";
import type { Notebook, Page } from "@/types";
import AIPanel from "@/components/AIPanel";
import PomodoroTimer from "@/components/PomodoroTimer";
import { useNotebookSession } from "@/contexts/SessionContext";

interface PageVersion {
  id: number;
  saved_at: string;
  title: string;
  saved_by_name: string;
  word_count: number;
}

interface PageVersionFull extends PageVersion {
  content: string;
}

interface Tag {
  id: number;
  name: string;
  color: string;
}

const TAG_COLORS = ["#6366f1","#10b981","#f59e0b","#dc2626","#ec4899","#14b8a6","#f97316","#8b5cf6"];

function HistoryPanel({
  pageId,
  onClose,
  onRestore,
}: {
  pageId: number;
  onClose: () => void;
  onRestore: (title: string, content: string) => void;
}) {
  const [versions, setVersions] = useState<PageVersion[]>([]);
  const [selected, setSelected] = useState<PageVersionFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    api.get<{ versions: PageVersion[] }>(`/pages/${pageId}/versions`)
      .then(r => setVersions(r.data.versions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pageId]);

  const selectVersion = async (v: PageVersion) => {
    const full = await api.get<PageVersionFull>(`/pages/${pageId}/versions/${v.id}`).then(r => r.data).catch(() => null);
    if (full) setSelected(full);
  };

  const restore = async () => {
    if (!selected) return;
    setRestoring(true);
    try {
      await api.post(`/pages/${pageId}/versions/${selected.id}/restore`);
      onRestore(selected.title, selected.content);
      onClose();
    } catch {} finally {
      setRestoring(false);
    }
  };

  return (
    <div className="history-panel">
      <div className="history-panel-header">
        <span>Version History</span>
        <button className="btn btn-ghost" style={{ padding: "2px 8px" }} onClick={onClose}>✕</button>
      </div>
      <div className="history-panel-body">
        {loading ? (
          <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
        ) : versions.length === 0 ? (
          <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>No versions yet — save a page to create one.</div>
        ) : (
          versions.map(v => (
            <div
              key={v.id}
              className={`version-item${selected?.id === v.id ? " selected" : ""}`}
              onClick={() => selectVersion(v)}
            >
              <div style={{ fontWeight: 500, fontSize: 13 }}>{v.title || "Untitled"}</div>
              <div className="version-item-meta">{new Date(v.saved_at).toLocaleString()} · {v.saved_by_name} · {v.word_count} words</div>
            </div>
          ))
        )}
      </div>
      {selected && (
        <div style={{ borderTop: "1px solid var(--border)", padding: 14, flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Preview: {selected.title}</div>
          <div className="history-preview" style={{ maxHeight: 220, overflow: "auto", fontSize: 13, padding: 0 }}>
            <ReactMarkdown>{selected.content || "_empty_"}</ReactMarkdown>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 10, width: "100%" }} onClick={restore} disabled={restoring}>
            {restoring ? "Restoring…" : "Restore this version"}
          </button>
        </div>
      )}
    </div>
  );
}

function TagEditor({ pageId, canEdit }: { pageId: number; canEdit: boolean }) {
  const [pageTags, setPageTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [showCreate, setShowCreate] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const fetchTags = useCallback(() => {
    Promise.all([
      api.get<{ tags: Tag[] }>(`/pages/${pageId}/tags`).then(r => r.data.tags),
      api.get<{ tags: Tag[] }>("/tags").then(r => r.data.tags),
    ]).then(([pt, at]) => { setPageTags(pt); setAllTags(at); }).catch(() => {});
  }, [pageId]);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false); setShowCreate(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const removeTag = async (tagId: number) => {
    await api.delete(`/pages/${pageId}/tags/${tagId}`).catch(() => {});
    setPageTags(prev => prev.filter(t => t.id !== tagId));
  };

  const addTag = async (tag: Tag) => {
    await api.post(`/pages/${pageId}/tags`, { tag_id: tag.id }).catch(() => {});
    setPageTags(prev => [...prev.filter(t => t.id !== tag.id), tag]);
    setShowDropdown(false);
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const res = await api.post<Tag>("/tags", { name: newTagName.trim(), color: newTagColor });
      const tag = res.data;
      setAllTags(prev => [...prev, tag]);
      await addTag(tag);
      setNewTagName(""); setShowCreate(false);
    } catch {}
  };

  const available = allTags.filter(t => !pageTags.find(pt => pt.id === t.id));

  return (
    <div className="tags-row" ref={wrapRef}>
      {pageTags.map(tag => (
        <span key={tag.id} className="tag-chip" style={{ background: tag.color }}>
          {tag.name}
          {canEdit && (
            <span className="tag-chip-remove" onClick={() => removeTag(tag.id)}>✕</span>
          )}
        </span>
      ))}
      {canEdit && (
        <div className="tag-add-wrap">
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "2px 8px" }} onClick={() => setShowDropdown(o => !o)}>
            + Tag
          </button>
          {showDropdown && (
            <div className="tag-dropdown">
              {available.map(tag => (
                <div key={tag.id} className="tag-dropdown-item" onClick={() => addTag(tag)}>
                  <span className="tag-dot" style={{ background: tag.color }} />
                  {tag.name}
                </div>
              ))}
              {!showCreate ? (
                <div className="tag-dropdown-item" onClick={() => setShowCreate(true)} style={{ borderTop: "1px solid var(--border)", color: "var(--accent)" }}>
                  + Create new tag
                </div>
              ) : (
                <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border)" }}>
                  <input
                    className="input"
                    style={{ marginBottom: 6, fontSize: 12, padding: "4px 8px" }}
                    placeholder="Tag name"
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && createTag()}
                    autoFocus
                  />
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                    {TAG_COLORS.map(c => (
                      <div
                        key={c}
                        onClick={() => setNewTagColor(c)}
                        style={{
                          width: 18, height: 18, borderRadius: "50%", background: c, cursor: "pointer",
                          outline: c === newTagColor ? "2px solid var(--text)" : "none", outlineOffset: 2,
                        }}
                      />
                    ))}
                  </div>
                  <button className="btn btn-primary" style={{ width: "100%", fontSize: 12, padding: "4px" }} onClick={createTag}>
                    Create
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function exportBlob(url: string, filename: string) {
  const token = localStorage.getItem("studynest_token") || "";
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch(() => {});
}

export default function PageEditorPage({ params }: { params: { id: string; pageId: string } }) {
  const notebookId = Number(params.id);
  const pageIdNum = Number(params.pageId);
  const router = useRouter();

  const [page, setPage] = useState<Page | null>(null);
  const [nb, setNb] = useState<Notebook | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const dirty = useRef(false);
  const { participants, emitPageUpdate } = useNotebookSession(notebookId);

  useEffect(() => {
    setLoading(true);
    Promise.all([pageApi.get(pageIdNum), notebookApi.get(notebookId)])
      .then(([p, n]) => { setPage(p); setNb(n); setTitle(p.title); setContent(p.content); })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [pageIdNum, notebookId]);

  const canEdit = page?.permission === "owner" || page?.permission === "edit";

  useEffect(() => {
    if (!page || !canEdit || !dirty.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSaveStatus("Saving...");
    saveTimer.current = window.setTimeout(async () => {
      try {
        await pageApi.update(page.id, { title, content });
        setSaveStatus("Saved ✓");
        dirty.current = false;
        window.dispatchEvent(new Event("studynest:refresh"));
        emitPageUpdate(notebookId, page.id, title, content);
        setTimeout(() => setSaveStatus(""), 1500);
      } catch (err) {
        setSaveStatus("");
        setError(getErrorMessage(err));
      }
    }, 800);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [title, content, page, canEdit]);

  const onTitleChange = (v: string) => { setTitle(v); dirty.current = true; };
  const onContentChange = (v: string) => { setContent(v); dirty.current = true; };

  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent).detail as { page_id: number; title: string; content: string; updated_by: string };
      if (data.page_id !== pageIdNum || dirty.current) return;
      setTitle(data.title); setContent(data.content);
      setSaveStatus(`Updated by ${data.updated_by}`);
      setTimeout(() => setSaveStatus(""), 2500);
    };
    window.addEventListener("studynest:page_updated", handler);
    return () => window.removeEventListener("studynest:page_updated", handler);
  }, [pageIdNum]);

  const deletePage = async () => {
    if (!page || !confirm("Delete this page?")) return;
    try {
      await pageApi.remove(page.id);
      window.dispatchEvent(new Event("studynest:refresh"));
      router.push(`/notebooks/${notebookId}`);
    } catch (err) { setError(getErrorMessage(err)); }
  };

  const handleRestore = (restoredTitle: string, restoredContent: string) => {
    setTitle(restoredTitle);
    setContent(restoredContent);
    dirty.current = true;
  };

  if (loading) return <div className="muted">Loading...</div>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!page || !nb) return null;

  const safeFilename = (title || "page").replace(/[^a-z0-9]/gi, "_");

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="page-header" style={{ marginBottom: 14 }}>
        <div className="flex gap-2" style={{ alignItems: "center" }}>
          <button className="btn btn-ghost" onClick={() => router.push(`/notebooks/${notebookId}`)}>
            ← {nb.icon} {nb.title}
          </button>
          <span className="muted" style={{ fontSize: 13 }}>{saveStatus}</span>
          {!canEdit && <span className="tag">👀 Read-only</span>}
          {participants.length > 1 && (
            <span className="tag session-live-tag">
              <span className="session-live-dot" />
              {participants.length} in session
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => exportBlob(`/api/pages/${page.id}/export`, `${safeFilename}.md`)} title="Export as Markdown">
            ↓ .md
          </button>
          {canEdit && (
            <button className="btn btn-ghost" onClick={() => setShowHistory(o => !o)} title="Version history">
              🕐 History
            </button>
          )}
          {canEdit && <button className="btn btn-danger" onClick={deletePage}>Delete page</button>}
        </div>
      </div>

      <TagEditor pageId={page.id} canEdit={canEdit} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, flex: 1, minHeight: 0 }}>
        <div className="editor-main" style={{ height: "100%" }}>
          <div className="editor-pane">
            <div className="editor-toolbar">
              <input className="title-input" value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="Page title" disabled={!canEdit} />
            </div>
            <textarea
              className="editor-textarea"
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="Start writing... Use **bold**, *italic*, # headings, - lists, `code`, etc. (markdown)"
              disabled={!canEdit}
            />
          </div>
          <div className="preview-pane">
            <div className="editor-toolbar"><span className="muted">Preview</span></div>
            <div className="preview-content">
              {content.trim() ? <ReactMarkdown>{content}</ReactMarkdown> : <div className="muted">Preview will appear here...</div>}
            </div>
          </div>
        </div>
        <AIPanel pageId={page.id} />
      </div>

      {showHistory && (
        <HistoryPanel
          pageId={page.id}
          onClose={() => setShowHistory(false)}
          onRestore={handleRestore}
        />
      )}

      <PomodoroTimer notebookId={notebookId} />
    </div>
  );
}
