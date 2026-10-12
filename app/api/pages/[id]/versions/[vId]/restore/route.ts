import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function POST(req: NextRequest, { params }: { params: { id: string; vId: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const vId = Number(params.vId);
  const [page] = await sql`SELECT notebook_id FROM pages WHERE id = ${pageId}`;
  if (!page) return err("Not found", 404);
  const { canAccess, permission } = await userCanAccess(page.notebook_id, user.id);
  if (!canAccess || !["owner", "edit"].includes(permission)) return err("Forbidden", 403);

  const [version] = await sql`SELECT title, content FROM page_versions WHERE id = ${vId} AND page_id = ${pageId}`;
  if (!version) return err("Version not found", 404);

  await sql`
    UPDATE pages SET title = ${version.title}, content = ${version.content}, updated_at = NOW()
    WHERE id = ${pageId}
  `;

  const [updated] = await sql`SELECT * FROM pages WHERE id = ${pageId}`;
  return ok(updated);
}
