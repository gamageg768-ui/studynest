import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const [page] = await sql`SELECT notebook_id FROM pages WHERE id = ${pageId}`;
  if (!page) return err("Not found", 404);
  const { canAccess } = await userCanAccess(page.notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);

  const versions = await sql`
    SELECT pv.id, pv.saved_at, pv.title, u.display_name AS saved_by_name,
           (length(pv.content) - length(replace(pv.content, ' ', '')) + 1) AS word_count
    FROM page_versions pv
    JOIN users u ON u.id = pv.saved_by
    WHERE pv.page_id = ${pageId}
    ORDER BY pv.saved_at DESC
    LIMIT 50
  `;

  return ok({ versions });
}
