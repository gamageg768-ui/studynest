import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const cardId = Number(params.id);
  const db = getDb();
  const card = db
    .prepare(
      `SELECT fc.*, fs.notebook_id FROM flashcards fc
       JOIN flashcard_sets fs ON fs.id = fc.set_id WHERE fc.id = ?`
    )
    .get(cardId) as any;
  if (!card) return err("Not found", 404);
  const { canAccess, permission } = userCanAccess(card.notebook_id, user.id);
  if (!canAccess || permission === "read") return err("Permission denied", 403);

  const data = await req.json().catch(() => ({}));
  const front = ((data.front as string) || "").trim() || card.front;
  const back = ((data.back as string) || "").trim() || card.back;
  db.prepare("UPDATE flashcards SET front = ?, back = ? WHERE id = ?").run(front, back, cardId);
  return ok({ id: cardId, set_id: card.set_id, front, back, position: card.position });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const cardId = Number(params.id);
  const db = getDb();
  const card = db
    .prepare(
      `SELECT fc.*, fs.notebook_id FROM flashcards fc
       JOIN flashcard_sets fs ON fs.id = fc.set_id WHERE fc.id = ?`
    )
    .get(cardId) as any;
  if (!card) return err("Not found", 404);
  const { canAccess, permission } = userCanAccess(card.notebook_id, user.id);
  if (!canAccess || permission === "read") return err("Permission denied", 403);
  db.prepare("DELETE FROM flashcards WHERE id = ?").run(cardId);
  return ok({ ok: true });
}
