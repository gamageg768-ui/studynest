import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const cardId = Number(params.id);
  const db = getDb();

  const card = db
    .prepare(
      `SELECT fc.*, fs.notebook_id FROM flashcards fc
       JOIN flashcard_sets fs ON fs.id = fc.set_id
       WHERE fc.id = ?`
    )
    .get(cardId) as any;
  if (!card) return err("Not found", 404);
  const { canAccess } = userCanAccess(card.notebook_id, user.id);
  if (!canAccess) return err("Forbidden", 403);

  const data = await req.json().catch(() => ({}));
  const quality = Number(data.quality);
  if (![0, 1, 2, 3, 4, 5].includes(quality)) return err("quality must be 0-5", 400);

  let ease_factor = card.ease_factor ?? 2.5;
  let interval_days = card.interval_days ?? 0;
  let repetitions = card.repetitions ?? 0;

  if (quality >= 3) {
    let newInterval: number;
    if (repetitions === 0) newInterval = 1;
    else if (repetitions === 1) newInterval = 6;
    else newInterval = Math.round(interval_days * ease_factor);

    ease_factor = Math.max(1.3, ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    interval_days = newInterval;
    repetitions += 1;
  } else {
    interval_days = 0;
    repetitions = 0;
  }

  const next_review = new Date(Date.now() + interval_days * 86400000).toISOString().slice(0, 19);

  db.prepare(
    `UPDATE flashcards SET ease_factor = ?, interval_days = ?, repetitions = ?, next_review = ?
     WHERE id = ?`
  ).run(ease_factor, interval_days, repetitions, next_review, cardId);

  return ok({ next_review, interval_days, repetitions, ease_factor });
}
