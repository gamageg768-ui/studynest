import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { auth, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const db = getDb();

  const notifications = db
    .prepare(
      `SELECT * FROM notifications WHERE user_id = ?
       ORDER BY is_read ASC, created_at DESC LIMIT 20`
    )
    .all(user.id);

  const { count } = db
    .prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0")
    .get(user.id) as any;

  return ok({ notifications, unread_count: count });
}
