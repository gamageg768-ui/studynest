import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const setId = Number(params.id);
  const [s] = await sql`SELECT * FROM flashcard_sets WHERE id = ${setId}`;
  if (!s) return err("Not found", 404);
  const { canAccess, permission } = await userCanAccess(s.notebook_id, user.id);
  if (!canAccess || permission === "read") return err("Permission denied", 403);

  const data = await req.json().catch(() => ({}));
  const front = ((data.front as string) || "").trim();
  const back = ((data.back as string) || "").trim();
  if (!front || !back) return err("front and back required", 400);

  const [maxPosRow] = await sql`SELECT COALESCE(MAX(position), -1) AS m FROM flashcards WHERE set_id = ${setId}`;
  const pos = ((maxPosRow?.m as number) ?? -1) + 1;
  const [card] = await sql`
    INSERT INTO flashcards (set_id, front, back, position) VALUES (${setId}, ${front}, ${back}, ${pos})
    RETURNING *
  `;
  return ok(card, 201);
}
