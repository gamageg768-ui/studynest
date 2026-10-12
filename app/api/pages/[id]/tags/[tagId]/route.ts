import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function DELETE(req: NextRequest, { params }: { params: { id: string; tagId: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const tagId = Number(params.tagId);
  const [page] = await sql`SELECT notebook_id FROM pages WHERE id = ${pageId}`;
  if (!page) return err("Not found", 404);
  const { canAccess, permission } = await userCanAccess(page.notebook_id, user.id);
  if (!canAccess || !["owner", "edit"].includes(permission)) return err("Forbidden", 403);

  await sql`DELETE FROM page_tags WHERE page_id = ${pageId} AND tag_id = ${tagId}`;
  return ok({ ok: true });
}
