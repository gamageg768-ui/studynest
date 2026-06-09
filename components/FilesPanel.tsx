"use client";
import { useEffect, useRef, useState, DragEvent } from "react";
import { fileApi, getErrorMessage } from "@/lib/client";
import type { Attachment } from "@/types";

type FileCategory = "image" | "audio" | "video" | "pdf" | "other";

function category(mime: string): FileCategory {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  return "other";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CAT_ICON: Record<FileCategory, string> = { image: "🖼️", audio: "🎵", video: "🎬", pdf: "📄", other: "📎" };

function FilePreview({ file, onClose }: { file: Attachment; onClose: () => void }) {
  const url = fileApi.url(file.id);
  const cat = category(file.mime_type);
  return (
    <div className="file-preview-backdrop" onClick={onClose}>
      <div className="file-preview-box" onClick={(e) => e.stopPropagation()}>
        <div className="file-preview-header">
          <span className="file-preview-name">{file.original_name}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <a className="btn btn-secondary" href={`${url}?download=1`} download={file.original_name} style={{ fontSize: 13 }}>⬇ Download</a>
            <button className="btn btn-ghost" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="file-preview-body">
          {cat === "image" && <img src={url} alt={file.original_name} className="file-preview-img" />}
          {cat === "audio" && <audio controls autoPlay src={url} className="file-preview-audio" />}
          {cat === "video" && <video controls autoPlay src={url} className="file-preview-video" />}
          {cat === "pdf" && <iframe src={url} title={file.original_name} className="file-preview-pdf" />}
          {cat === "other" && (
            <div className="file-preview-other">
              <div style={{ fontSize: 56 }}>📎</div>
              <div style={{ marginTop: 12 }}>{file.original_name}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{formatSize(file.file_size)}</div>
              <a className="btn btn-primary" href={`${url}?download=1`} download={file.original_name} style={{ marginTop: 16 }}>Download</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FileCard({ file, canEdit, onPreview, onDelete }: { file: Attachment; canEdit: boolean; onPreview: (f: Attachment) => void; onDelete: (id: number) => void }) {
  const cat = category(file.mime_type);
  const url = fileApi.url(file.id);
  return (
    <div className="file-card">
      <div className="file-card-thumb" onClick={() => onPreview(file)} title="Click to preview">
        {cat === "image" ? <img src={url} alt={file.original_name} className="file-thumb-img" /> : <span className="file-type-icon">{CAT_ICON[cat]}</span>}
      </div>
      <div className="file-card-info">
        <div className="file-card-name" title={file.original_name}>{file.original_name}</div>
        <div className="file-card-meta">{formatSize(file.file_size)}</div>
      </div>
      {canEdit && <button className="file-card-del btn btn-ghost" title="Delete" onClick={() => onDelete(file.id)}>✕</button>}
    </div>
  );
}

export default function FilesPanel({ notebookId, canEdit, onClose }: { notebookId: number; canEdit: boolean; onClose: () => void }) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fileApi.list(notebookId).then(setFiles).catch((e) => setError(getErrorMessage(e))).finally(() => setLoading(false));
  }, [notebookId]);

  const uploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError("");
    setUploading(true);
    setProgress(0);
    const total = fileList.length;
    for (let i = 0; i < total; i++) {
      try {
        const uploaded = await fileApi.upload(notebookId, fileList[i], (pct) => setProgress(Math.round((i * 100 + pct) / total)));
        setFiles((prev) => [uploaded, ...prev]);
      } catch (e) {
        setError(`Failed to upload ${fileList[i].name}: ${getErrorMessage(e)}`);
      }
    }
    setUploading(false);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (e: DragEvent) => { e.preventDefault(); setDragOver(false); if (canEdit) uploadFiles(e.dataTransfer.files); };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this file?")) return;
    try { await fileApi.remove(id); setFiles((prev) => prev.filter((f) => f.id !== id)); if (preview?.id === id) setPreview(null); }
    catch (e) { setError(getErrorMessage(e)); }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="files-modal" onClick={(e) => e.stopPropagation()}>
          <div className="files-modal-header">
            <h2>📎 Files</h2>
            <button className="btn btn-ghost" onClick={onClose}>✕</button>
          </div>
          {error && <div className="error-banner" style={{ margin: "0 20px" }}>{error}</div>}
          {canEdit && (
            <div
              className={`upload-zone ${dragOver ? "upload-zone-active" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input ref={inputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => uploadFiles(e.target.files)} />
              {uploading ? (
                <div style={{ width: "100%" }}>
                  <div className="muted" style={{ marginBottom: 8, fontSize: 13 }}>Uploading… {progress}%</div>
                  <div className="upload-progress-track"><div className="upload-progress-fill" style={{ width: `${progress}%` }} /></div>
                </div>
              ) : (
                <>
                  <span style={{ fontSize: 28 }}>⬆️</span>
                  <span>Drop files here or <strong>click to upload</strong></span>
                  <span className="muted" style={{ fontSize: 12 }}>Images, PDFs, audio, video, documents — up to 100 MB each</span>
                </>
              )}
            </div>
          )}
          <div className="files-modal-body">
            {loading && <div className="muted">Loading…</div>}
            {!loading && files.length === 0 && (
              <div className="empty-state">
                <div className="emoji">📎</div>
                <div>No files yet.</div>
                {canEdit && <div style={{ fontSize: 13, marginTop: 6 }}>Upload something above to get started.</div>}
              </div>
            )}
            {files.length > 0 && (
              <div className="files-grid">
                {files.map((f) => <FileCard key={f.id} file={f} canEdit={canEdit} onPreview={setPreview} onDelete={handleDelete} />)}
              </div>
            )}
          </div>
        </div>
      </div>
      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
