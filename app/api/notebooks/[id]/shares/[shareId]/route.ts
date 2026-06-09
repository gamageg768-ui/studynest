import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; shareId: string } }
) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const shareId = Number(params.shareId);
  const db = getDb();
  const nb = db.prepare("SELECT owner_id FROM notebooks WHERE id = ?").get(notebookId) as any;
  if (!nb || nb.owner_id !== user.id) return err("Forbidden", 403);
  db.prepare("DELETE FROM shares WHERE id = ? AND notebook_id = ?").run(shareId, notebookId);
  return ok({ ok: true });
}
