import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const [page] = await sql`SELECT * FROM pages WHERE id = ${pageId}`;
  if (!page) return err("Not found", 404);
  const { canAccess, permission } = await userCanAccess(page.notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);
  return ok({ ...page, permission });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const [page] = await sql`SELECT notebook_id FROM pages WHERE id = ${pageId}`;
  if (!page) return err("Not found", 404);
  const { canAccess, permission } = await userCanAccess(page.notebook_id, user.id);
  if (!canAccess || !["owner", "edit"].includes(permission)) return err("Forbidden", 403);

  const data = await req.json().catch(() => ({}));
  const hasTitle = "title" in data;
  const hasContent = "content" in data;
  if (!hasTitle && !hasContent) return err("No fields to update", 400);

  // Snapshot current content before overwrite
  const [existing] = await sql`SELECT title, content FROM pages WHERE id = ${pageId}`;
  if (existing) {
    await sql`
      INSERT INTO page_versions (page_id, title, content, saved_by)
      VALUES (${pageId}, ${existing.title}, ${existing.content ?? ""}, ${user.id})
    `;
    // Keep max 50 versions
    const old = await sql`
      SELECT id FROM page_versions WHERE page_id = ${pageId} ORDER BY saved_at DESC OFFSET 50
    `;
    if (old.length) {
      const ids = old.map((v: any) => v.id);
      await sql`DELETE FROM page_versions WHERE id = ANY(${ids}::int[])`;
    }
  }

  const newTitle = hasTitle ? (data.title as string) : existing?.title;
  const newContent = hasContent ? (data.content as string) : existing?.content;
  await sql`
    UPDATE pages SET title = ${newTitle}, content = ${newContent}, updated_at = NOW()
    WHERE id = ${pageId}
  `;
  await sql`UPDATE notebooks SET updated_at = NOW() WHERE id = ${page.notebook_id}`;
  const [updated] = await sql`SELECT * FROM pages WHERE id = ${pageId}`;
  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const [page] = await sql`SELECT notebook_id FROM pages WHERE id = ${pageId}`;
  if (!page) return err("Not found", 404);
  const { canAccess, permission } = await userCanAccess(page.notebook_id, user.id);
  if (!canAccess || !["owner", "edit"].includes(permission)) return err("Forbidden", 403);
  await sql`DELETE FROM pages WHERE id = ${pageId}`;
  return ok({ ok: true });
}
