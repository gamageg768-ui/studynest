import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const db = getDb();
  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId) as any;
  if (!page) return err("Not found", 404);
  const { canAccess, permission } = userCanAccess(page.notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);
  return ok({ ...page, permission });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const db = getDb();
  const page = db.prepare("SELECT notebook_id FROM pages WHERE id = ?").get(pageId) as any;
  if (!page) return err("Not found", 404);
  const { canAccess, permission } = userCanAccess(page.notebook_id, user.id);
  if (!canAccess || !["owner", "edit"].includes(permission)) return err("Forbidden", 403);

  const data = await req.json().catch(() => ({}));
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const k of ["title", "content"] as const) {
    if (k in data) { sets.push(`${k} = ?`); vals.push(data[k]); }
  }
  if (!sets.length) return err("No fields to update", 400);
  sets.push("updated_at = CURRENT_TIMESTAMP");
  vals.push(pageId);

  // Snapshot current content before overwrite
  const existing = db.prepare("SELECT title, content FROM pages WHERE id = ?").get(pageId) as any;
  if (existing) {
    db.prepare(
      "INSERT INTO page_versions (page_id, title, content, saved_by) VALUES (?, ?, ?, ?)"
    ).run(pageId, existing.title, existing.content ?? "", user.id);
    // Keep max 50 versions
    const old = db.prepare(
      "SELECT id FROM page_versions WHERE page_id = ? ORDER BY saved_at DESC LIMIT -1 OFFSET 50"
    ).all(pageId) as any[];
    if (old.length) {
      db.prepare(
        `DELETE FROM page_versions WHERE id IN (${old.map(() => "?").join(",")})`
      ).run(...old.map((v: any) => v.id));
    }
  }

  db.prepare(`UPDATE pages SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  db.prepare("UPDATE notebooks SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
    page.notebook_id
  );
  return ok(db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId));
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const db = getDb();
  const page = db.prepare("SELECT notebook_id FROM pages WHERE id = ?").get(pageId) as any;
  if (!page) return err("Not found", 404);
  const { canAccess, permission } = userCanAccess(page.notebook_id, user.id);
  if (!canAccess || !["owner", "edit"].includes(permission)) return err("Forbidden", 403);
  db.prepare("DELETE FROM pages WHERE id = ?").run(pageId);
  return ok({ ok: true });
}
