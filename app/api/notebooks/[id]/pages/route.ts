import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess, permission } = await userCanAccess(notebookId, user.id);
  if (!canAccess || !["owner", "edit"].includes(permission)) return err("Forbidden", 403);

  const data = await req.json().catch(() => ({}));
  const title = ((data.title as string) || "Untitled").trim() || "Untitled";
  const content = (data.content as string) || "";

  const [page] = await sql`
    INSERT INTO pages (notebook_id, title, content) VALUES (${notebookId}, ${title}, ${content})
    RETURNING *
  `;
  await sql`UPDATE notebooks SET updated_at = NOW() WHERE id = ${notebookId}`;
  return ok(page, 201);
}
