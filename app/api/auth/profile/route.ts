import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function PATCH(req: NextRequest) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const data = await req.json().catch(() => ({}));
  const display_name = ((data.display_name as string) || "").trim();
  if (!display_name) return err("Display name cannot be empty", 400);

  await sql`UPDATE users SET display_name = ${display_name} WHERE id = ${user.id}`;
  const [updated] = await sql`SELECT id, username, display_name, is_guest FROM users WHERE id = ${user.id}`;
  return ok({ user: updated });
}
