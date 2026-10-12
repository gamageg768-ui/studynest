import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const commentId = Number(params.id);
  const db = getDb();
  const comment = db.prepare(
    "SELECT pc.*, p.notebook_id FROM page_comments pc JOIN pages p ON p.id = pc.page_id WHERE pc.id = ?"
  ).get(commentId) as any;
  if (!comment) return err("Not found", 404);
  const { canAccess, permission } = userCanAccess(comment.notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);
  // Only comment author, owner, or admin can resolve
  if (comment.user_id !== user.id && permission !== "owner" && permission !== "admin") return err("Forbidden", 403);
  db.prepare("UPDATE page_comments SET resolved = 1 WHERE id = ?").run(commentId);
  return ok({ ok: true });
}
