import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const db = getDb();
  const nb = db.prepare("SELECT owner_id, is_pinned FROM notebooks WHERE id = ?").get(notebookId) as any;
  if (!nb) return err("Not found", 404);
  if (nb.owner_id !== user.id) return err("Only the owner can pin notebooks", 403);

  const newPinned = nb.is_pinned ? 0 : 1;
  db.prepare("UPDATE notebooks SET is_pinned = ? WHERE id = ?").run(newPinned, notebookId);
  return ok({ is_pinned: newPinned });
}
