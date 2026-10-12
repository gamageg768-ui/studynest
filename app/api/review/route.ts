import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { auth, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const uid = user.id;

  const cards = await sql`
    SELECT fc.*, fs.title AS set_title, fs.notebook_id
    FROM flashcards fc
    JOIN flashcard_sets fs ON fs.id = fc.set_id
    JOIN notebooks n ON n.id = fs.notebook_id
    WHERE (n.owner_id = ${uid} OR EXISTS (
      SELECT 1 FROM shares s WHERE s.notebook_id = n.id AND s.shared_with_user_id = ${uid}
    ))
    AND fc.next_review IS NOT NULL
    AND fc.next_review <= NOW()
    ORDER BY fc.next_review ASC
  `;

  return ok({ cards, count: cards.length });
}
