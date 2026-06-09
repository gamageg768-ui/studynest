import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const db = getDb();
  const page = db.prepare("SELECT notebook_id FROM pages WHERE id = ?").get(pageId) as any;
  if (!page) return err("Not found", 404);
  const { canAccess } = userCanAccess(page.notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);

  const tags = db
    .prepare(
      `SELECT t.* FROM tags t
       JOIN page_tags pt ON pt.tag_id = t.id
       WHERE pt.page_id = ?`
    )
    .all(pageId);
  return ok({ tags });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const db = getDb();
  const page = db.prepare("SELECT notebook_id FROM pages WHERE id = ?").get(pageId) as any;
  if (!page) return err("Not found", 404);
  const { canAccess, permission } = userCanAccess(page.notebook_id, user.id);
  if (!canAccess || !["owner", "edit"].includes(permission)) return err("Forbidden", 403);

  const data = await req.json().catch(() => ({}));
  const tagId = Number(data.tag_id);
  if (!tagId) return err("tag_id is required", 400);

  const tag = db.prepare("SELECT user_id FROM tags WHERE id = ?").get(tagId) as any;
  if (!tag) return err("Tag not found", 404);

  try {
    db.prepare("INSERT OR IGNORE INTO page_tags (page_id, tag_id) VALUES (?, ?)").run(pageId, tagId);
  } catch {
    return err("Could not add tag", 500);
  }
  return ok({ ok: true });
}
