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

  const tags = await sql`
    SELECT t.* FROM tags t
    JOIN page_tags pt ON pt.tag_id = t.id
    WHERE pt.page_id = ${pageId}
  `;
  return ok({ tags });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const [page] = await sql`SELECT notebook_id FROM pages WHERE id = ${pageId}`;
  if (!page) return err("Not found", 404);
  const { canAccess, permission } = await userCanAccess(page.notebook_id, user.id);
  if (!canAccess || !["owner", "edit"].includes(permission)) return err("Forbidden", 403);

  const data = await req.json().catch(() => ({}));
  const tagId = Number(data.tag_id);
  if (!tagId) return err("tag_id is required", 400);

  const [tag] = await sql`SELECT user_id FROM tags WHERE id = ${tagId}`;
  if (!tag) return err("Tag not found", 404);

  try {
    await sql`INSERT INTO page_tags (page_id, tag_id) VALUES (${pageId}, ${tagId}) ON CONFLICT DO NOTHING`;
  } catch {
    return err("Could not add tag", 500);
  }
  return ok({ ok: true });
}
