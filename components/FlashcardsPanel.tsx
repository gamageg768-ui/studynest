"use client";
import { useEffect, useRef, useState } from "react";
import { flashcardApi, aiApi, getErrorMessage } from "@/lib/client";
import type { FlashcardSet, FlashcardSetWithCards, Flashcard } from "@/types";
import { getSocket } from "@/lib/socket";

interface Props {
  notebookId: number;
  pages: { id: number; title: string }[];
  canEdit: boolean;
  onClose: () => void;
}

type View = "list" | "study" | "edit" | "create";

function StudyAvatars({ participants }: { participants: { id: number; display_name: string }[] }) {
  const unique = participants.filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i);
  if (unique.length < 2) return null;
  return (
    <div className="fc-study-participants">
      {unique.slice(0, 5).map((p) => (
        <div key={p.id} className="session-avatar" title={p.display_name}>{p.display_name[0].toUpperCase()}</div>
      ))}
      {unique.length > 5 && <div className="session-avatar">+{unique.length - 5}</div>}
      <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>studying together</span>
    </div>
  );
}

function FlipCard({ card, flipped, onFlip }: { card: Flashcard; flipped: boolean; onFlip: () => void }) {
  return (
    <div className="fc-flip-wrapper" onClick={onFlip}>
      <div className={`fc-flip-inner ${flipped ? "fc-flipped" : ""}`}>
        <div className="fc-face fc-face-front">
          <div className="fc-label">Question</div>
          <div className="fc-text">{card.front}</div>
          <div className="fc-hint">Click to reveal answer</div>
        </div>
        <div className="fc-face fc-face-back">
          <div className="fc-label">Answer</div>
          <div className="fc-text">{card.back}</div>
        </div>
      </div>
    </div>
  );
}

export default function FlashcardsPanel({ notebookId, pages, canEdit, onClose }: Props) {
  const [view, setView] = useState<View>("list");
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentSet, setCurrentSet] = useState<FlashcardSetWithCards | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState<Flashcard[]>([]);
  const [studyParticipants, setStudyParticipants] = useState<{ id: number; display_name: string }[]>([]);
  const [editTitle, setEditTitle] = useState("");
  const [editCards, setEditCards] = useState<{ front: string; back: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<number | "">(pages[0]?.id ?? "");
  const [aiCount, setAiCount] = useState(8);
  const token = typeof window !== "undefined" ? localStorage.getItem("studynest_token") || "" : "";

  useEffect(() => {
    flashcardApi.listSets(notebookId).then(setSets).catch((e) => setError(getErrorMessage(e))).finally(() => setLoading(false));
  }, [notebookId]);

  useEffect(() => {
    if (view !== "study" || !currentSet) return;
    const socket = getSocket();
    socket.emit("join_study", { token, set_id: currentSet.id });
    socket.on("study_state", (data: { card_index: number; participants: typeof studyParticipants }) => {
      setCardIndex(data.card_index); setFlipped(false); setStudyParticipants(data.participants);
    });
    socket.on("study_navigate", (data: { index: number }) => { setCardIndex(data.index); setFlipped(false); });
    socket.on("study_user_joined", (data: { user: { id: number; display_name: string } }) => {
      setStudyParticipants((p) => p.find((x) => x.id === data.user.id) ? p : [...p, data.user]);
    });
    socket.on("study_user_left", (data: { user: { id: number; display_name: string } }) => {
      setStudyParticipants((p) => p.filter((x) => x.id !== data.user.id));
    });
    return () => {
      socket.emit("leave_study", { set_id: currentSet.id });
      socket.off("study_state"); socket.off("study_navigate"); socket.off("study_user_joined"); socket.off("study_user_left");
    };
  }, [view, currentSet?.id]);

  const gotoCard = (index: number) => {
    if (!currentSet) return;
    setCardIndex(index); setFlipped(false);
    getSocket().emit("study_goto", { token, set_id: currentSet.id, index });
  };

  const openStudy = async (set: FlashcardSet) => {
    setError("");
    try {
      const full = await flashcardApi.getSet(set.id);
      setCurrentSet(full); setShuffled([...full.cards]); setCardIndex(0); setFlipped(false); setView("study");
    } catch (e) { setError(getErrorMessage(e)); }
  };

  const shuffleCards = () => {
    if (!currentSet) return;
    const arr = [...shuffled];
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    setShuffled(arr); gotoCard(0);
  };

  const openEdit = async (set: FlashcardSet) => {
    setError("");
    try {
      const full = await flashcardApi.getSet(set.id);
      setCurrentSet(full); setEditTitle(full.title); setEditCards(full.cards.map((c) => ({ front: c.front, back: c.back }))); setView("edit");
    } catch (e) { setError(getErrorMessage(e)); }
  };

  const openCreate = () => { setCurrentSet(null); setEditTitle(""); setEditCards([{ front: "", back: "" }]); setView("create"); };

  const handleAiGenerate = async () => {
    setAiLoading(true); setError("");
    try {
      const result = await aiApi.generateFlashcards({
        page_id: selectedPageId !== "" ? Number(selectedPageId) : undefined,
        notebook_id: selectedPageId === "" ? notebookId : undefined,
        count: aiCount,
      });
      setEditTitle(result.suggested_title); setEditCards(result.cards.map((c) => ({ front: c.front, back: c.back }))); setCurrentSet(null); setView("create");
    } catch (e) { setError(getErrorMessage(e)); } finally { setAiLoading(false); }
  };

  const handleSave = async () => {
    const title = editTitle.trim();
    if (!title) { setError("Title required"); return; }
    const validCards = editCards.filter((c) => c.front.trim() && c.back.trim());
    if (validCards.length === 0) { setError("Add at least one card"); return; }
    setSaving(true); setError("");
    try {
      if (currentSet) {
        await flashcardApi.updateSet(currentSet.id, title);
        for (const c of currentSet.cards) await flashcardApi.deleteCard(c.id);
        for (const c of validCards) await flashcardApi.addCard(currentSet.id, c.front, c.back);
      } else {
        await flashcardApi.createSet(notebookId, title, validCards);
      }
      setSets(await flashcardApi.listSets(notebookId));
      setView("list");
    } catch (e) { setError(getErrorMessage(e)); } finally { setSaving(false); }
  };

  const handleDelete = async (setId: number) => {
    if (!confirm("Delete this flashcard set?")) return;
    try { await flashcardApi.deleteSet(setId); setSets((prev) => prev.filter((s) => s.id !== setId)); }
    catch (e) { setError(getErrorMessage(e)); }
  };

  const cards = shuffled.length > 0 ? shuffled : currentSet?.cards ?? [];
  const current = cards[cardIndex];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="fc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fc-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {view !== "list" && <button className="btn btn-ghost" onClick={() => setView("list")}>← Back</button>}
            <h2 style={{ margin: 0, fontSize: 18 }}>
              🃏 {view === "list" ? "Flashcards" : view === "study" ? currentSet?.title : view === "create" ? "New Set" : currentSet?.title ?? "Edit Set"}
            </h2>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        {error && <div className="error-banner" style={{ margin: "0 20px 0" }}>{error}</div>}

        {view === "list" && (
          <div className="fc-body">
            {canEdit && pages.length > 0 && (
              <div className="fc-ai-strip">
                <span style={{ fontWeight: 600, fontSize: 13 }}>🤖 AI Generate</span>
                <select className="fc-select" value={selectedPageId} onChange={(e) => setSelectedPageId(e.target.value === "" ? "" : Number(e.target.value))}>
                  <option value="">Whole notebook</option>
                  {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <select className="fc-select" value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))}>
                  {[4, 6, 8, 10, 15, 20].map((n) => <option key={n} value={n}>{n} cards</option>)}
                </select>
                <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={handleAiGenerate} disabled={aiLoading}>
                  {aiLoading ? "Generating…" : "Generate"}
                </button>
              </div>
            )}
            {loading && <div className="muted" style={{ padding: "20px 0" }}>Loading…</div>}
            {!loading && sets.length === 0 && (
              <div className="empty-state">
                <div className="emoji">🃏</div>
                <div>No flashcard sets yet.</div>
                {canEdit && <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={openCreate}>Create your first set</button>}
              </div>
            )}
            {sets.length > 0 && (
              <div className="fc-set-list">
                {sets.map((s) => (
                  <div key={s.id} className="fc-set-card">
                    <div className="fc-set-info">
                      <div className="fc-set-title">{s.title}</div>
                      <div className="fc-set-meta">{s.card_count} card{s.card_count !== 1 ? "s" : ""}</div>
                    </div>
                    <div className="fc-set-actions">
                      <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => openStudy(s)}>▶ Study</button>
                      {canEdit && (
                        <>
                          <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => openEdit(s)}>Edit</button>
                          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => handleDelete(s.id)}>✕</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {canEdit && sets.length > 0 && (
              <div style={{ marginTop: 16, textAlign: "center" }}>
                <button className="btn btn-secondary" onClick={openCreate}>+ New Set</button>
              </div>
            )}
          </div>
        )}

        {view === "study" && currentSet && (
          <div className="fc-body fc-study">
            <StudyAvatars participants={studyParticipants} />
            {cards.length === 0 ? (
              <div className="empty-state">No cards in this set.</div>
            ) : (
              <>
                <div className="fc-progress">{cardIndex + 1} / {cards.length}</div>
                <FlipCard card={current} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
                <div className="fc-nav">
                  <button className="btn btn-secondary" disabled={cardIndex === 0} onClick={() => gotoCard(cardIndex - 1)}>← Prev</button>
                  <button className="btn btn-ghost" onClick={shuffleCards} title="Shuffle">🔀 Shuffle</button>
                  <button className="btn btn-secondary" disabled={cardIndex === cards.length - 1} onClick={() => gotoCard(cardIndex + 1)}>Next →</button>
                </div>
                <div className="fc-dots">
                  {cards.map((_, i) => (
                    <div key={i} className={`fc-dot ${i === cardIndex ? "fc-dot-active" : ""}`} onClick={() => gotoCard(i)} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {(view === "create" || view === "edit") && (
          <div className="fc-body">
            <input className="input" placeholder="Set title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }} />
            <div className="fc-card-editor">
              <div className="fc-card-editor-header">
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-muted)" }}>FRONT</span>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-muted)" }}>BACK</span>
                <span />
              </div>
              {editCards.map((c, i) => (
                <div key={i} className="fc-card-row">
                  <textarea className="fc-card-input" placeholder="Question / Term" value={c.front} rows={2}
                    onChange={(e) => { const arr = [...editCards]; arr[i] = { ...arr[i], front: e.target.value }; setEditCards(arr); }} />
                  <textarea className="fc-card-input" placeholder="Answer / Definition" value={c.back} rows={2}
                    onChange={(e) => { const arr = [...editCards]; arr[i] = { ...arr[i], back: e.target.value }; setEditCards(arr); }} />
                  <button className="btn btn-ghost" style={{ padding: "4px 8px" }} onClick={() => setEditCards((arr) => arr.filter((_, j) => j !== i))} disabled={editCards.length === 1}>✕</button>
                </div>
              ))}
            </div>
            <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={() => setEditCards((arr) => [...arr, { front: "", back: "" }])}>+ Add card</button>
            <div className="fc-edit-actions">
              <button className="btn btn-ghost" onClick={() => setView("list")}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save set"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
