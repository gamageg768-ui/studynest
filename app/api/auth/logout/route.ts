import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";
import { getTokenFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const token = getTokenFromRequest(req);
  await sql`DELETE FROM sessions WHERE token = ${token}`;
  return ok({ ok: true });
}
