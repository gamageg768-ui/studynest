import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { auth, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  const user = await auth(req);
  if (isResponse(user)) return user;

  const notifications = await sql`
    SELECT * FROM notifications WHERE user_id = ${user.id}
    ORDER BY is_read ASC, created_at DESC LIMIT 20
  `;

  const [countRow] = await sql`
    SELECT COUNT(*) AS count FROM notifications WHERE user_id = ${user.id} AND is_read = FALSE
  `;

  return ok({ notifications, unread_count: countRow?.count ?? 0 });
}
