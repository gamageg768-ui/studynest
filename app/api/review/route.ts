import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { auth, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const db = getDb();
  const uid = user.id;

  const cards = db
    .prepare(
      `SELECT fc.*, fs.title AS set_title, fs.notebook_id
       FROM flashcards fc
       JOIN flashcard_sets fs ON fs.id = fc.set_id
       JOIN notebooks n ON n.id = fs.notebook_id
       WHERE (n.owner_id = ? OR EXISTS (
         SELECT 1 FROM shares s WHERE s.notebook_id = n.id AND s.shared_with_user_id = ?
       ))
       AND fc.next_review IS NOT NULL
       AND fc.next_review <= datetime('now')
       ORDER BY fc.next_review ASC`
    )
    .all(uid, uid);

  return ok({ cards, count: cards.length });
}
