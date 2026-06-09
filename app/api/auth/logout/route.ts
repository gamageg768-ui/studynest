import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";
import { getTokenFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const token = getTokenFromRequest(req);
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  return ok({ ok: true });
}
