import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const notifId = Number(params.id);
  const db = getDb();
  const notif = db.prepare("SELECT user_id FROM notifications WHERE id = ?").get(notifId) as any;
  if (!notif || notif.user_id !== user.id) return err("Not found", 404);
  db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(notifId);
  return ok({ ok: true });
}
