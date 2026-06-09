import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function DELETE(req: NextRequest, { params }: { params: { id: string; tagId: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const tagId = Number(params.tagId);
  const db = getDb();
  const page = db.prepare("SELECT notebook_id FROM pages WHERE id = ?").get(pageId) as any;
  if (!page) return err("Not found", 404);
  const { canAccess, permission } = userCanAccess(page.notebook_id, user.id);
  if (!canAccess || !["owner", "edit"].includes(permission)) return err("Forbidden", 403);

  db.prepare("DELETE FROM page_tags WHERE page_id = ? AND tag_id = ?").run(pageId, tagId);
  return ok({ ok: true });
}
