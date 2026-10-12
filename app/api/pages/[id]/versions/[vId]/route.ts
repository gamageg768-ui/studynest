import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string; vId: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const vId = Number(params.vId);
  const [page] = await sql`SELECT notebook_id FROM pages WHERE id = ${pageId}`;
  if (!page) return err("Not found", 404);
  const { canAccess } = await userCanAccess(page.notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);

  const [version] = await sql`
    SELECT pv.*, u.display_name AS saved_by_name
    FROM page_versions pv JOIN users u ON u.id = pv.saved_by
    WHERE pv.id = ${vId} AND pv.page_id = ${pageId}
  `;
  if (!version) return err("Version not found", 404);
  return ok(version);
}
