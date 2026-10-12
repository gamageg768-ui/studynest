import { randomBytes } from "crypto";
import { sql } from "./db";
import { NextRequest } from "next/server";

export interface SessionUser {
  id: number;
  username: string;
  display_name: string;
  is_guest: boolean;
}

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function getUserFromToken(token: string): Promise<SessionUser | null> {
  if (!token) return null;
  const [row] = await sql`
    SELECT u.id, u.username, u.display_name, u.is_guest
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token}
  `;
  return (row as SessionUser) || null;
}

export function getTokenFromRequest(req: NextRequest): string {
  const auth = req.headers.get("authorization") || "";
  return auth.replace("Bearer ", "").trim();
}

export async function requireAuth(req: NextRequest): Promise<SessionUser | null> {
  const token = getTokenFromRequest(req);
  return getUserFromToken(token);
}
