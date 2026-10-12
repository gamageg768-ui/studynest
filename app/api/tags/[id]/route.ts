import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const tagId = Number(params.id);
  const [tag] = await sql`SELECT user_id FROM tags WHERE id = ${tagId}`;
  if (!tag || tag.user_id !== user.id) return err("Not found", 404);

  const data = await req.json().catch(() => ({}));
  if (!data.name && !data.color) return err("No fields to update", 400);

  const newName = data.name ? (data.name as string).trim() : null;
  const newColor = data.color ? (data.color as string) : null;
  await sql`
    UPDATE tags SET
      name = COALESCE(${newName}, name),
      color = COALESCE(${newColor}, color)
    WHERE id = ${tagId}
  `;
  const [updated] = await sql`SELECT * FROM tags WHERE id = ${tagId}`;
  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const tagId = Number(params.id);
  const [tag] = await sql`SELECT user_id FROM tags WHERE id = ${tagId}`;
  if (!tag || tag.user_id !== user.id) return err("Not found", 404);
  await sql`DELETE FROM tags WHERE id = ${tagId}`;
  return ok({ ok: true });
}
