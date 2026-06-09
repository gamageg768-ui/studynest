"use client";

const SHORTCUTS = [
  { keys: "?", description: "Open keyboard shortcut help" },
  { keys: "Ctrl+K", description: "Focus search" },
  { keys: "Ctrl+B", description: "Go to dashboard" },
  { keys: "Ctrl+Shift+N", description: "New notebook" },
  { keys: "Ctrl+Shift+F", description: "Toggle dark / light mode" },
  { keys: "Escape", description: "Close modal / panel" },
];

export default function KeyboardShortcuts({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h2 style={{ margin: "0 0 16px" }}>Keyboard shortcuts</h2>
        <table className="shortcut-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.keys}>
                <td style={{ paddingRight: 20 }}>
                  {s.keys.split("+").map((k, i) => (
                    <span key={k}>
                      {i > 0 && <span style={{ color: "var(--text-muted)", margin: "0 3px" }}>+</span>}
                      <span className="shortcut-key">{k}</span>
                    </span>
                  ))}
                </td>
                <td>{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
