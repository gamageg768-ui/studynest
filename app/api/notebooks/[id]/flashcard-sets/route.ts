import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess } = userCanAccess(notebookId, user.id);
  if (!canAccess) return err("Not found", 404);
  const sets = getDb()
    .prepare(
      `SELECT fs.id, fs.notebook_id, fs.title, fs.created_at,
              COUNT(fc.id) AS card_count
       FROM flashcard_sets fs
       LEFT JOIN flashcards fc ON fc.set_id = fs.id
       WHERE fs.notebook_id = ?
       GROUP BY fs.id ORDER BY fs.created_at DESC`
    )
    .all(notebookId);
  return ok({ sets });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess, permission } = userCanAccess(notebookId, user.id);
  if (!canAccess || permission === "read") return err("Permission denied", 403);

  const data = await req.json().catch(() => ({}));
  const title = ((data.title as string) || "").trim();
  if (!title) return err("title required", 400);
  const cards: { front: string; back: string }[] = data.cards || [];

  const db = getDb();
  const result = db
    .prepare("INSERT INTO flashcard_sets (notebook_id, title) VALUES (?, ?)")
    .run(notebookId, title);
  const setId = result.lastInsertRowid as number;
  const insertCard = db.prepare(
    "INSERT INTO flashcards (set_id, front, back, position) VALUES (?, ?, ?, ?)"
  );
  for (let i = 0; i < cards.length; i++) {
    insertCard.run(setId, cards[i].front || "", cards[i].back || "", i);
  }
  const row = db.prepare("SELECT * FROM flashcard_sets WHERE id = ?").get(setId) as any;
  return ok({ ...row, card_count: cards.length }, 201);
}
