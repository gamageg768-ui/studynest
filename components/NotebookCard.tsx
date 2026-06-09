"use client";
import { useRouter } from "next/navigation";
import type { Notebook } from "@/types";

interface Props {
  notebook: Notebook;
  onPin?: (id: number) => void;
}

export default function NotebookCard({ notebook, onPin }: Props) {
  const router = useRouter();
  return (
    <div
      className={`notebook-card${notebook.is_pinned ? " notebook-card-pinned" : ""}`}
      style={{ background: notebook.color }}
      onClick={() => router.push(`/notebooks/${notebook.id}`)}
    >
      {onPin && notebook.permission === "owner" && (
        <button
          className="pin-btn"
          onClick={(e) => { e.stopPropagation(); onPin(notebook.id); }}
          title={notebook.is_pinned ? "Unpin" : "Pin to top"}
        >
          {notebook.is_pinned ? "📌" : "📍"}
        </button>
      )}
      <div>
        <div className="icon">{notebook.icon}</div>
        <div className="title">{notebook.title}</div>
        {notebook.description && <div className="desc">{notebook.description}</div>}
      </div>
      <div className="meta">
        {notebook.permission && notebook.permission !== "owner" && (
          <span className="tag">{notebook.permission === "edit" ? "✏️ Can edit" : "👀 Read only"}</span>
        )}
        {notebook.owner_name && notebook.permission !== "owner" && (
          <span className="tag">by {notebook.owner_name}</span>
        )}
      </div>
    </div>
  );
}
