import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; shareId: string } }
) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const shareId = Number(params.shareId);
  const [nb] = await sql`SELECT owner_id FROM notebooks WHERE id = ${notebookId}`;
  if (!nb || nb.owner_id !== user.id) return err("Forbidden", 403);
  await sql`DELETE FROM shares WHERE id = ${shareId} AND notebook_id = ${notebookId}`;
  return ok({ ok: true });
}
