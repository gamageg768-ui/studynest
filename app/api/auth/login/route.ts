import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { generateToken } from "@/lib/auth";
import { err, ok } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  const data = await req.json().catch(() => ({}));
  const username = ((data.username as string) || "").trim().toLowerCase();
  const password = (data.password as string) || "";

  if (!username || !password) return err("Username and password are required", 400);

  const [user] = await sql`SELECT id, username, password_hash, display_name FROM users WHERE username = ${username}`;

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return err("Invalid username or password", 401);
  }

  const token = generateToken();
  await sql`INSERT INTO sessions (token, user_id) VALUES (${token}, ${user.id})`;

  return ok({
    token,
    user: { id: user.id, username: user.username, display_name: user.display_name },
  });
}
