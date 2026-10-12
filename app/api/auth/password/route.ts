import { NextRequest } from "next/server";
import bcryptjs from "bcryptjs";
import { sql } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function PATCH(req: NextRequest) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  if (user.is_guest) return err("Guests cannot change their password", 403);

  const data = await req.json().catch(() => ({}));
  const current = (data.current_password as string) || "";
  const next = (data.new_password as string) || "";
  if (!current || !next) return err("Both current and new password are required", 400);
  if (next.length < 6) return err("New password must be at least 6 characters", 400);

  const [row] = await sql`SELECT password_hash FROM users WHERE id = ${user.id}`;
  if (!await bcryptjs.compare(current, row.password_hash)) return err("Current password is incorrect", 400);

  const hash = await bcryptjs.hash(next, 10);
  await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${user.id}`;
  return ok({ ok: true });
}
