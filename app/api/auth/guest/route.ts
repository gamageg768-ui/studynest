import { randomBytes } from "crypto";
import bcryptjs from "bcryptjs";
import { sql } from "@/lib/db";
import { generateToken } from "@/lib/auth";
import { ok } from "@/lib/api-utils";

export async function POST() {
  const username = `guest_${randomBytes(6).toString("hex")}`;
  const disabledHash = await bcryptjs.hash(randomBytes(16).toString("hex"), 10);
  const [newUser] = await sql`
    INSERT INTO users (username, password_hash, display_name, is_guest) VALUES (${username}, ${disabledHash}, ${"Guest"}, ${true})
    RETURNING id
  `;
  const userId = newUser.id as number;
  const token = generateToken();
  await sql`INSERT INTO sessions (token, user_id) VALUES (${token}, ${userId})`;
  return ok(
    { token, user: { id: userId, username, display_name: "Guest", is_guest: true } },
    201
  );
}
