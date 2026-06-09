"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getErrorMessage } from "@/lib/client";

interface ReviewCard {
  id: number;
  front: string;
  back: string;
  set_title: string;
  notebook_id: number;
  next_review: string;
}

const RATINGS = [
  { label: "Again", quality: 0, color: "#dc2626" },
  { label: "Hard", quality: 2, color: "#f59e0b" },
  { label: "Good", quality: 4, color: "#10b981" },
  { label: "Easy", quality: 5, color: "#6366f1" },
];

export default function ReviewPage() {
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState(0);

  useEffect(() => {
    api.get<{ cards: ReviewCard[]; count: number }>("/review")
      .then(r => setCards(r.data.cards))
      .catch(e => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  const submitRating = async (quality: number) => {
    const card = cards[index];
    try {
      await api.post(`/flashcards/${card.id}/review`, { quality });
    } catch {}
    setReviewed(r => r + 1);
    setFlipped(false);
    setIndex(i => i + 1);
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }} className="muted">Loading review queue…</div>;
  if (error) return <div className="error-banner" style={{ margin: 40 }}>{error}</div>;

  const done = index >= cards.length;
  const total = cards.length;
  const progress = total > 0 ? (index / total) * 100 : 100;
  const card = cards[index];

  return (
    <div className="review-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>🃏 Review cards</h1>
        <Link href="/dashboard" className="btn btn-ghost">← Dashboard</Link>
      </div>

      {!done && (
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
          {index + 1} of {total} cards
        </div>
      )}
      <div className="review-progress">
        <div className="review-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      {done ? (
        <div className="review-done">
          <div className="review-done-emoji">🎉</div>
          <h2 style={{ margin: "0 0 8px" }}>All done!</h2>
          <p style={{ color: "var(--text-muted)", margin: "0 0 20px" }}>
            You reviewed {reviewed} card{reviewed !== 1 ? "s" : ""}. Come back tomorrow for more!
          </p>
          <Link href="/dashboard" className="btn btn-primary">Back to dashboard</Link>
        </div>
      ) : (
        <>
          <div
            className={`review-card${flipped ? " review-card-back" : ""}`}
            onClick={() => setFlipped(f => !f)}
            title={flipped ? "Click to see front" : "Click to reveal answer"}
          >
            <div>
              {flipped ? (
                <span>{card.back}</span>
              ) : (
                <span>{card.front}</span>
              )}
            </div>
          </div>
          <div style={{ textAlign: "center", marginBottom: 14, fontSize: 12, color: "var(--text-muted)" }}>
            {flipped ? "How well did you remember?" : "Tap card to reveal answer"}
          </div>
          {flipped && (
            <div className="review-rating-row">
              {RATINGS.map(r => (
                <button
                  key={r.quality}
                  className="review-rating-btn"
                  style={{ borderColor: r.color, color: r.color }}
                  onClick={() => submitRating(r.quality)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "var(--text-muted)" }}>
            from: {card.set_title}
          </div>
        </>
      )}
    </div>
  );
}
