import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

function getSetOrErr(setId: number, userId: number) {
  const db = getDb();
  const s = db.prepare("SELECT * FROM flashcard_sets WHERE id = ?").get(setId) as any;
  if (!s) return { s: null, permission: "", notFound: true };
  const { canAccess, permission } = userCanAccess(s.notebook_id, userId);
  if (!canAccess) return { s: null, permission: "", notFound: true };
  return { s, permission, notFound: false };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const { s, notFound } = getSetOrErr(Number(params.id), user.id);
  if (notFound || !s) return err("Not found", 404);
  const cards = getDb()
    .prepare("SELECT * FROM flashcards WHERE set_id = ? ORDER BY position")
    .all(s.id);
  return ok({ ...s, cards });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const { s, permission, notFound } = getSetOrErr(Number(params.id), user.id);
  if (notFound || !s) return err("Not found", 404);
  if (permission === "read") return err("Permission denied", 403);
  const data = await req.json().catch(() => ({}));
  const title = ((data.title as string) || "").trim();
  if (!title) return err("title required", 400);
  getDb().prepare("UPDATE flashcard_sets SET title = ? WHERE id = ?").run(title, s.id);
  return ok({ ...s, title });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const { s, permission, notFound } = getSetOrErr(Number(params.id), user.id);
  if (notFound || !s) return err("Not found", 404);
  if (permission === "read") return err("Permission denied", 403);
  getDb().prepare("DELETE FROM flashcard_sets WHERE id = ?").run(s.id);
  return ok({ ok: true });
}
