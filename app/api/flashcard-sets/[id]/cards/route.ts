import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const setId = Number(params.id);
  const db = getDb();
  const s = db.prepare("SELECT * FROM flashcard_sets WHERE id = ?").get(setId) as any;
  if (!s) return err("Not found", 404);
  const { canAccess, permission } = userCanAccess(s.notebook_id, user.id);
  if (!canAccess || permission === "read") return err("Permission denied", 403);

  const data = await req.json().catch(() => ({}));
  const front = ((data.front as string) || "").trim();
  const back = ((data.back as string) || "").trim();
  if (!front || !back) return err("front and back required", 400);

  const maxPosRow = db
    .prepare("SELECT COALESCE(MAX(position), -1) AS m FROM flashcards WHERE set_id = ?")
    .get(setId) as any;
  const pos = (maxPosRow?.m ?? -1) + 1;
  const result = db
    .prepare("INSERT INTO flashcards (set_id, front, back, position) VALUES (?, ?, ?, ?)")
    .run(setId, front, back, pos);
  const card = db.prepare("SELECT * FROM flashcards WHERE id = ?").get(result.lastInsertRowid);
  return ok(card, 201);
}
