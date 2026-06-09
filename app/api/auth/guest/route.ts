import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";
import { generateToken } from "@/lib/auth";
import { ok } from "@/lib/api-utils";

export async function POST() {
  const username = `guest_${randomBytes(6).toString("hex")}`;
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO users (username, password_hash, display_name, is_guest) VALUES (?, ?, ?, 1)"
    )
    .run(username, "", "Guest");
  const userId = result.lastInsertRowid as number;
  const token = generateToken();
  db.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(token, userId);
  return ok(
    { token, user: { id: userId, username, display_name: "Guest", is_guest: true } },
    201
  );
}
