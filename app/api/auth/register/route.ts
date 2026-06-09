import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { generateToken } from "@/lib/auth";
import { err, ok } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  const data = await req.json().catch(() => ({}));
  const username = ((data.username as string) || "").trim().toLowerCase();
  const password = (data.password as string) || "";
  const display_name = ((data.display_name as string) || username).trim();

  if (!username || !password) return err("Username and password are required", 400);
  if (username.length < 3 || username.length > 30)
    return err("Username must be 3-30 characters", 400);
  if (password.length < 6) return err("Password must be at least 6 characters", 400);

  const pw_hash = await bcrypt.hash(password, 10);
  const db = getDb();
  try {
    const result = db
      .prepare("INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)")
      .run(username, pw_hash, display_name);
    const userId = result.lastInsertRowid as number;
    const token = generateToken();
    db.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(token, userId);
    return ok({ token, user: { id: userId, username, display_name } }, 201);
  } catch (e: any) {
    if (String(e).includes("UNIQUE")) return err("Username already taken", 409);
    return err("Could not create account", 500);
  }
}
