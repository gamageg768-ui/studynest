import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const tagId = Number(params.id);
  const db = getDb();
  const tag = db.prepare("SELECT user_id FROM tags WHERE id = ?").get(tagId) as any;
  if (!tag || tag.user_id !== user.id) return err("Not found", 404);

  const data = await req.json().catch(() => ({}));
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (data.name) { sets.push("name = ?"); vals.push((data.name as string).trim()); }
  if (data.color) { sets.push("color = ?"); vals.push(data.color); }
  if (!sets.length) return err("No fields to update", 400);
  vals.push(tagId);
  db.prepare(`UPDATE tags SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return ok(db.prepare("SELECT * FROM tags WHERE id = ?").get(tagId));
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const tagId = Number(params.id);
  const db = getDb();
  const tag = db.prepare("SELECT user_id FROM tags WHERE id = ?").get(tagId) as any;
  if (!tag || tag.user_id !== user.id) return err("Not found", 404);
  db.prepare("DELETE FROM tags WHERE id = ?").run(tagId);
  return ok({ ok: true });
}
