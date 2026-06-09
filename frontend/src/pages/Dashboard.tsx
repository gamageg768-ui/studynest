import { useEffect, useState } from "react";
import { notebookApi, getErrorMessage } from "../api/client";
import type { Notebook } from "../api/types";
import NotebookCard from "../components/NotebookCard";
import { useAuth } from "../context/AuthContext";

const COLORS = [
  "#fef3c7",
  "#fce7f3",
  "#dbeafe",
  "#dcfce7",
  "#ede9fe",
  "#fee2e2",
  "#cffafe",
  "#fed7aa",
];
const ICONS = ["📒", "📚", "🧪", "🧮", "🌍", "🎨", "💻", "🎵", "⚽", "🧠"];

export default function Dashboard() {
  const { user } = useAuth();
  const [owned, setOwned] = useState<Notebook[]>([]);
  const [shared, setShared] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  const refresh = () => {
    setLoading(true);
    notebookApi
      .list()
      .then(({ owned, shared }) => {
        setOwned(owned);
        setShared(shared);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Hey {user?.display_name?.split(" ")[0]} 👋
          </h1>
          <p className="page-subtitle">
            Pick up where you left off, or start a new notebook.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New notebook
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <h3 style={{ margin: "16px 0 10px" }}>My notebooks</h3>
      {loading ? (
        <div className="muted">Loading...</div>
      ) : owned.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">📒</div>
          <div>No notebooks yet — create one to get started!</div>
        </div>
      ) : (
        <div className="notebook-grid">
          {owned.map((nb) => (
            <NotebookCard key={nb.id} notebook={nb} />
          ))}
        </div>
      )}

      {shared.length > 0 && (
        <>
          <h3 style={{ margin: "28px 0 10px" }}>Shared with me</h3>
          <div className="notebook-grid">
            {shared.map((nb) => (
              <NotebookCard key={nb.id} notebook={nb} />
            ))}
          </div>
        </>
      )}

      {showModal && (
        <CreateNotebookModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            refresh();
            window.dispatchEvent(new Event("studynest:refresh"));
            setShowModal(false);
          }}
        />
      )}
    </>
  );
}

function CreateNotebookModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState(ICONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setError("");
    try {
      await notebookApi.create({ title, description, color, icon });
      onCreated();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New notebook</h2>
        <p>Each notebook is a workspace — like one per class or topic.</p>
        {error && <div className="error-banner">{error}</div>}
        <div className="modal-form">
          <div>
            <label>Title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Calculus II"
              autoFocus
            />
          </div>
          <div>
            <label>Description (optional)</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this notebook for?"
            />
          </div>
          <div>
            <label>Icon</label>
            <div className="icon-row">
              {ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  className={"icon-btn" + (icon === i ? " selected" : "")}
                  onClick={() => setIcon(i)}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label>Color</label>
            <div className="color-row">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={"color-swatch" + (color === c ? " selected" : "")}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? "Creating..." : "Create notebook"}
          </button>
        </div>
      </div>
    </div>
  );
}
