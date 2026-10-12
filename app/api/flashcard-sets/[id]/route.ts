import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

async function getSetOrErr(setId: number, userId: number) {
  const [s] = await sql`SELECT * FROM flashcard_sets WHERE id = ${setId}`;
  if (!s) return { s: null, permission: "", notFound: true };
  const { canAccess, permission } = await userCanAccess(s.notebook_id, userId);
  if (!canAccess) return { s: null, permission: "", notFound: true };
  return { s, permission, notFound: false };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const { s, notFound } = await getSetOrErr(Number(params.id), user.id);
  if (notFound || !s) return err("Not found", 404);
  const cards = await sql`SELECT * FROM flashcards WHERE set_id = ${s.id} ORDER BY position`;
  return ok({ ...s, cards });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const { s, permission, notFound } = await getSetOrErr(Number(params.id), user.id);
  if (notFound || !s) return err("Not found", 404);
  if (permission === "read") return err("Permission denied", 403);
  const data = await req.json().catch(() => ({}));
  const title = ((data.title as string) || "").trim();
  if (!title) return err("title required", 400);
  await sql`UPDATE flashcard_sets SET title = ${title} WHERE id = ${s.id}`;
  return ok({ ...s, title });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const { s, permission, notFound } = await getSetOrErr(Number(params.id), user.id);
  if (notFound || !s) return err("Not found", 404);
  if (permission === "read") return err("Permission denied", 403);
  await sql`DELETE FROM flashcard_sets WHERE id = ${s.id}`;
  return ok({ ok: true });
}
