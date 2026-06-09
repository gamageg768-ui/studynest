import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function PATCH(req: NextRequest) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const data = await req.json().catch(() => ({}));
  const display_name = ((data.display_name as string) || "").trim();
  if (!display_name) return err("Display name cannot be empty", 400);

  const db = getDb();
  db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(display_name, user.id);
  const updated = db.prepare("SELECT id, username, display_name, is_guest FROM users WHERE id = ?").get(user.id) as any;
  return ok({ user: updated });
}
