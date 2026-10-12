import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess } = await userCanAccess(notebookId, user.id);
  if (!canAccess) return err("Not found", 404);
  const sets = await sql`
    SELECT fs.id, fs.notebook_id, fs.title, fs.created_at,
           COUNT(fc.id) AS card_count
    FROM flashcard_sets fs
    LEFT JOIN flashcards fc ON fc.set_id = fs.id
    WHERE fs.notebook_id = ${notebookId}
    GROUP BY fs.id ORDER BY fs.created_at DESC
  `;
  return ok({ sets });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess, permission } = await userCanAccess(notebookId, user.id);
  if (!canAccess || permission === "read") return err("Permission denied", 403);

  const data = await req.json().catch(() => ({}));
  const title = ((data.title as string) || "").trim();
  if (!title) return err("title required", 400);
  const cards: { front: string; back: string }[] = data.cards || [];

  const [newSet] = await sql`
    INSERT INTO flashcard_sets (notebook_id, title) VALUES (${notebookId}, ${title})
    RETURNING *
  `;
  const setId = newSet.id as number;
  for (let i = 0; i < cards.length; i++) {
    await sql`
      INSERT INTO flashcards (set_id, front, back, position) VALUES (${setId}, ${cards[i].front || ""}, ${cards[i].back || ""}, ${i})
    `;
  }
  return ok({ ...newSet, card_count: cards.length }, 201);
}
