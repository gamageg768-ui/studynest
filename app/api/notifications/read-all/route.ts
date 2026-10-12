import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { auth, ok, isResponse } from "@/lib/api-utils";

export async function PATCH(req: NextRequest) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  await sql`UPDATE notifications SET is_read = TRUE WHERE user_id = ${user.id}`;
  return ok({ ok: true });
}
