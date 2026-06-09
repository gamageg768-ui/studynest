import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { auth, ok, isResponse } from "@/lib/api-utils";

export async function PATCH(req: NextRequest) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const db = getDb();
  db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(user.id);
  return ok({ ok: true });
}
