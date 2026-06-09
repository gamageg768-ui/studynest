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

  const versions = db
    .prepare(
      `SELECT pv.id, pv.saved_at, pv.title, u.display_name AS saved_by_name,
              (length(pv.content) - length(replace(pv.content, ' ', '')) + 1) AS word_count
       FROM page_versions pv
       JOIN users u ON u.id = pv.saved_by
       WHERE pv.page_id = ?
       ORDER BY pv.saved_at DESC
       LIMIT 50`
    )
    .all(pageId);

  return ok({ versions });
}
