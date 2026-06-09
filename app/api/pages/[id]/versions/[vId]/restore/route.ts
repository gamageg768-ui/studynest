import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function POST(req: NextRequest, { params }: { params: { id: string; vId: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const vId = Number(params.vId);
  const db = getDb();
  const page = db.prepare("SELECT notebook_id FROM pages WHERE id = ?").get(pageId) as any;
  if (!page) return err("Not found", 404);
  const { canAccess, permission } = userCanAccess(page.notebook_id, user.id);
  if (!canAccess || !["owner", "edit"].includes(permission)) return err("Forbidden", 403);

  const version = db
    .prepare("SELECT title, content FROM page_versions WHERE id = ? AND page_id = ?")
    .get(vId, pageId) as any;
  if (!version) return err("Version not found", 404);

  db.prepare(
    "UPDATE pages SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(version.title, version.content, pageId);

  return ok(db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId));
}
