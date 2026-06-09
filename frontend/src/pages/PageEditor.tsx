import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  pageApi,
  notebookApi,
  getErrorMessage,
} from "../api/client";
import type { Notebook, Page } from "../api/types";
import AIPanel from "../components/AIPanel";
import { useNotebookSession } from "../context/SessionContext";

export default function PageEditor() {
  const { id, pageId } = useParams();
  const notebookId = Number(id);
  const pageIdNum = Number(pageId);
  const navigate = useNavigate();

  const [page, setPage] = useState<Page | null>(null);
  const [nb, setNb] = useState<Notebook | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const saveTimer = useRef<number | null>(null);
  const dirty = useRef(false);
  const { participants, emitPageUpdate } = useNotebookSession(notebookId);

  useEffect(() => {
    setLoading(true);
    Promise.all([pageApi.get(pageIdNum), notebookApi.get(notebookId)])
      .then(([p, n]) => {
        setPage(p);
        setNb(n);
        setTitle(p.title);
        setContent(p.content);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [pageIdNum, notebookId]);

  const canEdit =
    page?.permission === "owner" || page?.permission === "edit";

  // Debounced autosave
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
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [title, content, page, canEdit]);

  const onTitleChange = (v: string) => {
    setTitle(v);
    dirty.current = true;
  };
  const onContentChange = (v: string) => {
    setContent(v);
    dirty.current = true;
  };

  // Receive live updates from session participants
  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent).detail as {
        page_id: number;
        title: string;
        content: string;
        updated_by: string;
      };
      if (data.page_id !== pageIdNum || dirty.current) return;
      setTitle(data.title);
      setContent(data.content);
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
      navigate(`/notebooks/${notebookId}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (loading) return <div className="muted">Loading...</div>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!page || !nb) return null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="page-header" style={{ marginBottom: 14 }}>
        <div className="flex gap-2" style={{ alignItems: "center" }}>
          <button
            className="btn btn-ghost"
            onClick={() => navigate(`/notebooks/${notebookId}`)}
          >
            ← {nb.icon} {nb.title}
          </button>
          <span className="muted" style={{ fontSize: 13 }}>
            {saveStatus}
          </span>
          {!canEdit && <span className="tag">👀 Read-only</span>}
          {participants.length > 1 && (
            <span className="tag session-live-tag">
              <span className="session-live-dot" />
              {participants.length} in session
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <button className="btn btn-danger" onClick={deletePage}>
              Delete page
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: 16,
          flex: 1,
          minHeight: 0,
        }}
      >
        <div className="editor-main" style={{ height: "100%" }}>
          <div className="editor-pane">
            <div className="editor-toolbar">
              <input
                className="title-input"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Page title"
                disabled={!canEdit}
              />
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
            <div className="editor-toolbar">
              <span className="muted">Preview</span>
            </div>
            <div className="preview-content">
              {content.trim() ? (
                <ReactMarkdown>{content}</ReactMarkdown>
              ) : (
                <div className="muted">Preview will appear here...</div>
              )}
            </div>
          </div>
        </div>

        <AIPanel pageId={page.id} />
      </div>
    </div>
  );
}
