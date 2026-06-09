import { useNavigate } from "react-router-dom";
import type { Notebook } from "../api/types";

export default function NotebookCard({ notebook }: { notebook: Notebook }) {
  const navigate = useNavigate();
  return (
    <div
      className="notebook-card"
      style={{ background: notebook.color }}
      onClick={() => navigate(`/notebooks/${notebook.id}`)}
    >
      <div>
        <div className="icon">{notebook.icon}</div>
        <div className="title">{notebook.title}</div>
        {notebook.description && (
          <div className="desc">{notebook.description}</div>
        )}
      </div>
      <div className="meta">
        {notebook.permission && notebook.permission !== "owner" && (
          <span className="tag">
            {notebook.permission === "edit" ? "✏️ Can edit" : "👀 Read only"}
          </span>
        )}
        {notebook.owner_name && notebook.permission !== "owner" && (
          <span className="tag">by {notebook.owner_name}</span>
        )}
      </div>
    </div>
  );
}
