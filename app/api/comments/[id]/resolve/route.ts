import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const commentId = Number(params.id);
  const [comment] = await sql`
    SELECT pc.*, p.notebook_id FROM page_comments pc JOIN pages p ON p.id = pc.page_id WHERE pc.id = ${commentId}
  `;
  if (!comment) return err("Not found", 404);
  const { canAccess, permission } = await userCanAccess(comment.notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);
  // Only comment author, owner, or admin can resolve
  if (comment.user_id !== user.id && permission !== "owner" && permission !== "admin") return err("Forbidden", 403);
  await sql`UPDATE page_comments SET resolved = TRUE WHERE id = ${commentId}`;
  return ok({ ok: true });
}
