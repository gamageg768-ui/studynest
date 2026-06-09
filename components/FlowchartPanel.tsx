"use client";
import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { flowchartApi, aiApi, getErrorMessage } from "@/lib/client";
import type { Flowchart } from "@/types";
import { getSocket } from "@/lib/socket";

mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });

interface Props {
  notebookId: number;
  pages: { id: number; title: string }[];
  canEdit: boolean;
  onClose: () => void;
}

type View = "list" | "view" | "edit" | "create";

function useMermaid(source: string) {
  const [svg, setSvg] = useState("");
  const [renderError, setRenderError] = useState("");
  const idRef = useRef(0);
  useEffect(() => {
    if (!source.trim()) { setSvg(""); setRenderError(""); return; }
    const id = `mermaid-${++idRef.current}`;
    setRenderError("");
    mermaid.render(id, source)
      .then(({ svg: out }) => setSvg(out))
      .catch((e: unknown) => { setSvg(""); setRenderError(e instanceof Error ? e.message : "Diagram syntax error"); });
  }, [source]);
  return { svg, renderError };
}

function CollabBar({ participants }: { participants: { id: number; display_name: string }[] }) {
  const unique = participants.filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i);
  if (unique.length === 0) return null;
  return (
    <div className="fc-study-participants">
      {unique.slice(0, 5).map((p) => <div key={p.id} className="session-avatar" title={p.display_name}>{p.display_name[0].toUpperCase()}</div>)}
      {unique.length > 5 && <div className="session-avatar">+{unique.length - 5}</div>}
      <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>viewing</span>
    </div>
  );
}

function DiagramView({ svg, error }: { svg: string; error: string }) {
  if (error) return <div className="fc-diagram-error">{error}</div>;
  if (!svg) return <div className="muted" style={{ padding: 40 }}>No diagram yet.</div>;
  return <div className="fc-diagram-svg" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default function FlowchartPanel({ notebookId, pages, canEdit, onClose }: Props) {
  const [view, setView] = useState<View>("list");
  const [charts, setCharts] = useState<Flowchart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<Flowchart | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSource, setEditSource] = useState("flowchart TD\n    A[Start] --> B[End]");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [collaborators, setCollaborators] = useState<{ id: number; display_name: string }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<"page" | "description">("page");
  const [selectedPageId, setSelectedPageId] = useState<number | "">(pages[0]?.id ?? "");
  const [aiDescription, setAiDescription] = useState("");
  const [showAiPane, setShowAiPane] = useState(false);
  const [preview, setPreview] = useState(editSource);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { svg, renderError } = useMermaid(preview);
  const token = typeof window !== "undefined" ? localStorage.getItem("studynest_token") || "" : "";

  const updateSource = (val: string) => {
    setEditSource(val); setDirty(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setPreview(val), 600);
  };

  useEffect(() => {
    flowchartApi.list(notebookId).then(setCharts).catch((e) => setError(getErrorMessage(e))).finally(() => setLoading(false));
  }, [notebookId]);

  useEffect(() => {
    if ((view !== "view" && view !== "edit") || !current) return;
    const socket = getSocket();
    socket.emit("join_flowchart", { token, chart_id: current.id });
    socket.on("fc_state", (data: { participants: typeof collaborators }) => setCollaborators(data.participants));
    socket.on("fc_user_joined", (data: { user: { id: number; display_name: string } }) => {
      setCollaborators((p) => p.find((x) => x.id === data.user.id) ? p : [...p, data.user]);
    });
    socket.on("fc_user_left", (data: { user: { id: number; display_name: string } }) => {
      setCollaborators((p) => p.filter((x) => x.id !== data.user.id));
    });
    socket.on("fc_updated", (data: { source: string }) => {
      setEditSource(data.source); setPreview(data.source);
      setCurrent((c) => c ? { ...c, source: data.source } : c);
    });
    return () => {
      socket.emit("leave_flowchart", { chart_id: current.id });
      socket.off("fc_state"); socket.off("fc_user_joined"); socket.off("fc_user_left"); socket.off("fc_updated");
    };
  }, [view, current?.id]);

  const openView = (chart: Flowchart) => { setCurrent(chart); setEditSource(chart.source); setPreview(chart.source); setDirty(false); setCollaborators([]); setView("view"); };
  const openEdit = (chart: Flowchart) => { setCurrent(chart); setEditTitle(chart.title); setEditSource(chart.source); setPreview(chart.source); setDirty(false); setCollaborators([]); setView("edit"); };
  const openCreate = () => { setCurrent(null); setEditTitle(""); const s = "flowchart TD\n    A[Start] --> B[End]"; setEditSource(s); setPreview(s); setDirty(false); setCollaborators([]); setView("create"); };

  const handleSave = async () => {
    const title = editTitle.trim();
    if (!title) { setError("Title required"); return; }
    setSaving(true); setError("");
    try {
      if (current) {
        const updated = await flowchartApi.update(current.id, { title, source: editSource });
        setCharts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setCurrent(updated); setDirty(false);
        getSocket().emit("flowchart_save", { token, chart_id: current.id, source: editSource });
        setView("view");
      } else {
        const created = await flowchartApi.create(notebookId, title, editSource);
        setCharts((prev) => [created, ...prev]); setCurrent(created); setView("view");
      }
    } catch (e) { setError(getErrorMessage(e)); } finally { setSaving(false); }
  };

  const handleDelete = async (chartId: number) => {
    if (!confirm("Delete this flowchart?")) return;
    try { await flowchartApi.remove(chartId); setCharts((prev) => prev.filter((c) => c.id !== chartId)); if (current?.id === chartId) setView("list"); }
    catch (e) { setError(getErrorMessage(e)); }
  };

  const handleAiGenerate = async () => {
    setAiLoading(true); setError("");
    try {
      const params = aiMode === "page" && selectedPageId !== ""
        ? { page_id: Number(selectedPageId) }
        : { description: aiDescription, notebook_id: notebookId };
      const result = await aiApi.generateFlowchart(params);
      setEditTitle(result.suggested_title); setEditSource(result.source); setPreview(result.source); setDirty(true); setShowAiPane(false);
      if (view === "list") { setCurrent(null); setView("create"); }
    } catch (e) { setError(getErrorMessage(e)); } finally { setAiLoading(false); }
  };

  const downloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(current?.title || "flowchart").replace(/\s+/g, "_")}.svg`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="fc-modal fc-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="fc-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {view !== "list" && <button className="btn btn-ghost" onClick={() => { setView("list"); setShowAiPane(false); }}>← Back</button>}
            <h2 style={{ margin: 0, fontSize: 18 }}>🔷 {view === "list" ? "Flowcharts" : view === "create" ? "New Flowchart" : current?.title}</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(view === "view" || view === "edit") && svg && <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={downloadSvg}>⬇ SVG</button>}
            {view === "view" && canEdit && current && <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => openEdit(current)}>Edit</button>}
            {(view === "edit" || view === "create") && <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>}
            <button className="btn btn-ghost" onClick={onClose}>✕</button>
          </div>
        </div>

        {error && <div className="error-banner" style={{ margin: "0 20px" }}>{error}</div>}

        {view === "list" && (
          <div className="fc-body">
            {canEdit && (
              <div className="fc-ai-strip">
                <span style={{ fontWeight: 600, fontSize: 13 }}>🤖 AI Generate</span>
                <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setShowAiPane((v) => !v)}>{showAiPane ? "Cancel" : "Generate with AI"}</button>
                {!showAiPane && <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={openCreate}>+ Manual</button>}
              </div>
            )}
            {showAiPane && (
              <div className="fc-ai-pane">
                <div className="fc-ai-tabs">
                  <button className={`fc-ai-tab ${aiMode === "page" ? "active" : ""}`} onClick={() => setAiMode("page")}>From page</button>
                  <button className={`fc-ai-tab ${aiMode === "description" ? "active" : ""}`} onClick={() => setAiMode("description")}>From description</button>
                </div>
                {aiMode === "page" ? (
                  <select className="fc-select" value={selectedPageId} onChange={(e) => setSelectedPageId(Number(e.target.value))}>
                    {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                ) : (
                  <textarea className="fc-card-input" placeholder="Describe the process you want to visualise…" value={aiDescription} rows={3} onChange={(e) => setAiDescription(e.target.value)} style={{ width: "100%" }} />
                )}
                <button className="btn btn-primary" onClick={handleAiGenerate} disabled={aiLoading || (aiMode === "description" && !aiDescription.trim())}>
                  {aiLoading ? "Generating…" : "Generate Flowchart"}
                </button>
              </div>
            )}
            {loading && <div className="muted" style={{ padding: "20px 0" }}>Loading…</div>}
            {!loading && charts.length === 0 && (
              <div className="empty-state">
                <div className="emoji">🔷</div>
                <div>No flowcharts yet.</div>
                {canEdit && <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={openCreate}>Create your first flowchart</button>}
              </div>
            )}
            {charts.length > 0 && (
              <div className="fc-chart-list">
                {charts.map((c) => (
                  <div key={c.id} className="fc-chart-card" onClick={() => openView(c)}>
                    <div className="fc-chart-icon">🔷</div>
                    <div className="fc-set-info">
                      <div className="fc-set-title">{c.title}</div>
                      <div className="fc-set-meta">Updated {new Date(c.updated_at).toLocaleDateString()}</div>
                    </div>
                    {canEdit && (
                      <div className="fc-set-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => openEdit(c)}>Edit</button>
                        <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => handleDelete(c.id)}>✕</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "view" && current && (
          <div className="fc-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <CollabBar participants={collaborators} />
            <div className="fc-diagram-container"><DiagramView svg={svg} error={renderError} /></div>
          </div>
        )}

        {(view === "edit" || view === "create") && (
          <div className="fc-body" style={{ padding: 0 }}>
            <div className="fc-editor-shell">
              <div className="fc-editor-pane">
                <div className="fc-editor-toolbar">
                  <input className="title-input" placeholder="Flowchart title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  {canEdit && <button className="btn btn-ghost" style={{ fontSize: 12, whiteSpace: "nowrap" }} onClick={() => setShowAiPane((v) => !v)}>🤖 AI</button>}
                </div>
                {showAiPane && (
                  <div className="fc-ai-pane" style={{ borderRadius: 0, borderLeft: "none", borderRight: "none" }}>
                    <div className="fc-ai-tabs">
                      <button className={`fc-ai-tab ${aiMode === "page" ? "active" : ""}`} onClick={() => setAiMode("page")}>From page</button>
                      <button className={`fc-ai-tab ${aiMode === "description" ? "active" : ""}`} onClick={() => setAiMode("description")}>From description</button>
                    </div>
                    {aiMode === "page" ? (
                      <select className="fc-select" value={selectedPageId} onChange={(e) => setSelectedPageId(Number(e.target.value))}>
                        {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                    ) : (
                      <textarea className="fc-card-input" placeholder="Describe the process…" value={aiDescription} rows={2} onChange={(e) => setAiDescription(e.target.value)} style={{ width: "100%" }} />
                    )}
                    <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={handleAiGenerate} disabled={aiLoading}>{aiLoading ? "Generating…" : "Generate"}</button>
                  </div>
                )}
                <textarea className="fc-source-editor" value={editSource} onChange={(e) => updateSource(e.target.value)} spellCheck={false} placeholder={"flowchart TD\n    A[Start] --> B[End]"} />
              </div>
              <div className="fc-preview-pane">
                <div className="fc-editor-toolbar" style={{ borderLeft: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Preview</span>
                  {dirty && <span style={{ fontSize: 11, color: "var(--warning)" }}>● unsaved</span>}
                </div>
                <div className="fc-diagram-container"><DiagramView svg={svg} error={renderError} /></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
