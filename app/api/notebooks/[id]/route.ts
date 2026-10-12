import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess, permission } = await userCanAccess(notebookId, user.id);
  if (!canAccess) return err("Not found", 404);

  const [nb] = await sql`
    SELECT n.*, u.display_name AS owner_name
    FROM notebooks n JOIN users u ON u.id = n.owner_id
    WHERE n.id = ${notebookId}
  `;
  const pages = await sql`
    SELECT id, title, created_at, updated_at FROM pages WHERE notebook_id = ${notebookId} ORDER BY updated_at DESC
  `;

  return ok({ ...nb, permission, pages });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess, permission } = await userCanAccess(notebookId, user.id);
  if (!canAccess || !["owner", "edit"].includes(permission)) return err("Forbidden", 403);

  const data = await req.json().catch(() => ({}));
  const allowed = ["title", "description", "color", "icon"] as const;
  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in data) updates[k] = data[k];
  }
  if (!Object.keys(updates).length) return err("No fields to update", 400);

  // Build dynamic update — use individual field updates
  const { title, description, color, icon } = updates as any;
  await sql`
    UPDATE notebooks SET
      title = COALESCE(${title ?? null}, title),
      description = COALESCE(${description ?? null}, description),
      color = COALESCE(${color ?? null}, color),
      icon = COALESCE(${icon ?? null}, icon),
      updated_at = NOW()
    WHERE id = ${notebookId}
  `;
  const [notebook] = await sql`SELECT * FROM notebooks WHERE id = ${notebookId}`;
  return ok(notebook);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const [nb] = await sql`SELECT owner_id FROM notebooks WHERE id = ${notebookId}`;
  if (!nb) return err("Not found", 404);
  if (nb.owner_id !== user.id) return err("Only the owner can delete", 403);
  await sql`DELETE FROM notebooks WHERE id = ${notebookId}`;
  return ok({ ok: true });
}
