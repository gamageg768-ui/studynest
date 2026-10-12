import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notifId = Number(params.id);
  const [notif] = await sql`SELECT user_id FROM notifications WHERE id = ${notifId}`;
  if (!notif || notif.user_id !== user.id) return err("Not found", 404);
  await sql`UPDATE notifications SET is_read = TRUE WHERE id = ${notifId}`;
  return ok({ ok: true });
}
