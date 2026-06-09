import { randomBytes } from "crypto";
import { getDb } from "./db";
import { NextRequest } from "next/server";

export interface SessionUser {
  id: number;
  username: string;
  display_name: string;
  is_guest: number;
}

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function getUserFromToken(token: string): SessionUser | null {
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.is_guest
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as SessionUser | undefined;
  return row || null;
}

export function getTokenFromRequest(req: NextRequest): string {
  const auth = req.headers.get("authorization") || "";
  return auth.replace("Bearer ", "").trim();
}

export function requireAuth(req: NextRequest): SessionUser | null {
  const token = getTokenFromRequest(req);
  return getUserFromToken(token);
}
