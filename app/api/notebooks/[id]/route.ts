import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess, permission } = userCanAccess(notebookId, user.id);
  if (!canAccess) return err("Not found", 404);

  const db = getDb();
  const nb = db
    .prepare(
      `SELECT n.*, u.display_name AS owner_name
       FROM notebooks n JOIN users u ON u.id = n.owner_id
       WHERE n.id = ?`
    )
    .get(notebookId) as any;
  const pages = db
    .prepare(
      "SELECT id, title, created_at, updated_at FROM pages WHERE notebook_id = ? ORDER BY updated_at DESC"
    )
    .all(notebookId);

  return ok({ ...nb, permission, pages });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess, permission } = userCanAccess(notebookId, user.id);
  if (!canAccess || !["owner", "edit"].includes(permission)) return err("Forbidden", 403);

  const data = await req.json().catch(() => ({}));
  const allowed = ["title", "description", "color", "icon"] as const;
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const k of allowed) {
    if (k in data) { sets.push(`${k} = ?`); vals.push(data[k]); }
  }
  if (!sets.length) return err("No fields to update", 400);
  sets.push("updated_at = CURRENT_TIMESTAMP");
  vals.push(notebookId);

  const db = getDb();
  db.prepare(`UPDATE notebooks SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return ok(db.prepare("SELECT * FROM notebooks WHERE id = ?").get(notebookId));
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const db = getDb();
  const nb = db.prepare("SELECT owner_id FROM notebooks WHERE id = ?").get(notebookId) as any;
  if (!nb) return err("Not found", 404);
  if (nb.owner_id !== user.id) return err("Only the owner can delete", 403);
  db.prepare("DELETE FROM notebooks WHERE id = ?").run(notebookId);
  return ok({ ok: true });
}
