"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { notebookApi, pageApi, aiApi, getErrorMessage } from "@/lib/client";
import type { Notebook } from "@/types";
import ShareModal from "@/components/ShareModal";
import SessionPanel from "@/components/SessionPanel";
import FilesPanel from "@/components/FilesPanel";
import FlashcardsPanel from "@/components/FlashcardsPanel";
import FlowchartPanel from "@/components/FlowchartPanel";
import { useNotebookSession } from "@/contexts/SessionContext";

export default function NotebookPage({ params }: { params: { id: string } }) {
  const notebookId = Number(params.id);
  const router = useRouter();
  const [nb, setNb] = useState<Notebook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showFlowcharts, setShowFlowcharts] = useState(false);
  const [guide, setGuide] = useState("");
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideError, setGuideError] = useState("");
  const { participants } = useNotebookSession(notebookId);

  const refresh = () => {
    setLoading(true);
    notebookApi.get(notebookId).then(setNb).catch((err) => setError(getErrorMessage(err))).finally(() => setLoading(false));
  };

  useEffect(refresh, [notebookId]);

  const canEdit = nb?.permission === "owner" || nb?.permission === "edit";
  const isOwner = nb?.permission === "owner";

  const newPage = async () => {
    if (!canEdit) return;
    try {
      const page = await pageApi.create(notebookId, { title: "Untitled", content: "" });
      window.dispatchEvent(new Event("studynest:refresh"));
      router.push(`/notebooks/${notebookId}/pages/${page.id}`);
    } catch (err) { setError(getErrorMessage(err)); }
  };

  const deleteNotebook = async () => {
    if (!confirm("Delete this notebook and all its pages?")) return;
    try {
      await notebookApi.remove(notebookId);
      window.dispatchEvent(new Event("studynest:refresh"));
      router.push("/dashboard");
    } catch (err) { setError(getErrorMessage(err)); }
  };

  const buildGuide = async () => {
    setGuideError(""); setGuide(""); setGuideLoading(true);
    try { setGuide(await aiApi.studyGuide(notebookId)); }
    catch (err) { setGuideError(getErrorMessage(err)); }
    finally { setGuideLoading(false); }
  };

  if (loading) return <div className="muted">Loading notebook...</div>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!nb) return null;

  return (
    <>
      <div className="page-header">
        <div className="flex gap-3" style={{ alignItems: "center" }}>
          <span style={{ fontSize: 32 }}>{nb.icon}</span>
          <div>
            <h1 className="page-title">{nb.title}</h1>
            {nb.description && <p className="page-subtitle">{nb.description}</p>}
            {nb.permission !== "owner" && (
              <p className="page-subtitle">
                Shared by {nb.owner_name} · {nb.permission === "edit" ? "you can edit" : "read-only"}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && <button className="btn btn-primary" onClick={newPage}>+ New page</button>}
          <button className="btn btn-secondary" onClick={() => setShowFlashcards(true)}>🃏 Flashcards</button>
          <button className="btn btn-secondary" onClick={() => setShowFlowcharts(true)}>🔷 Flowcharts</button>
          <button className="btn btn-secondary" onClick={() => setShowFiles(true)}>📎 Files</button>
          {isOwner && <button className="btn btn-secondary" onClick={() => setShowShare(true)}>👥 Share</button>}
          <button className="btn btn-secondary" onClick={buildGuide} disabled={guideLoading || (nb.pages || []).length === 0}>🤖 Study guide</button>
          {isOwner && <button className="btn btn-danger" onClick={deleteNotebook}>Delete</button>}
        </div>
      </div>

      <SessionPanel participants={participants} />

      {(guide || guideLoading || guideError) && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="row-between" style={{ marginBottom: 8 }}>
            <strong>📚 AI-generated study guide</strong>
            <button className="btn btn-ghost" onClick={() => { setGuide(""); setGuideError(""); }}>×</button>
          </div>
          {guideLoading && <div className="muted"><span className="spinner" /> Building from your pages... (this may take 30-60s)</div>}
          {guideError && <div className="error-banner">{guideError}</div>}
          {guide && <div className="preview-content"><ReactMarkdown>{guide}</ReactMarkdown></div>}
        </div>
      )}

      <h3 style={{ margin: "10px 0 14px" }}>Pages</h3>
      {(nb.pages || []).length === 0 ? (
        <div className="empty-state">
          <div className="emoji">📝</div>
          <div>No pages yet.</div>
          {canEdit && <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={newPage}>Create your first page</button>}
        </div>
      ) : (
        <div className="notebook-grid">
          {(nb.pages || []).map((p) => (
            <div key={p.id} className="card" style={{ cursor: "pointer" }} onClick={() => router.push(`/notebooks/${notebookId}/pages/${p.id}`)}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.title}</div>
              <div className="muted" style={{ fontSize: 12 }}>Updated {new Date(p.updated_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {showShare && <ShareModal notebookId={notebookId} onClose={() => setShowShare(false)} />}
      {showFiles && <FilesPanel notebookId={notebookId} canEdit={canEdit} onClose={() => setShowFiles(false)} />}
      {showFlashcards && <FlashcardsPanel notebookId={notebookId} pages={nb.pages ?? []} canEdit={canEdit} onClose={() => setShowFlashcards(false)} />}
      {showFlowcharts && <FlowchartPanel notebookId={notebookId} pages={nb.pages ?? []} canEdit={canEdit} onClose={() => setShowFlowcharts(false)} />}
    </>
  );
}
