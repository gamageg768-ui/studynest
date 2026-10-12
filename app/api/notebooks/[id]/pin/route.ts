import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const [nb] = await sql`SELECT owner_id, is_pinned FROM notebooks WHERE id = ${notebookId}`;
  if (!nb) return err("Not found", 404);
  if (nb.owner_id !== user.id) return err("Only the owner can pin notebooks", 403);

  const newPinned = !nb.is_pinned;
  await sql`UPDATE notebooks SET is_pinned = ${newPinned} WHERE id = ${notebookId}`;
  return ok({ is_pinned: newPinned });
}
