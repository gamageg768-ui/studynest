import { NextRequest, NextResponse } from "next/server";
import { requireAuth, SessionUser } from "./auth";

export function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function auth(req: NextRequest): Promise<SessionUser | NextResponse> {
  const user = await requireAuth(req);
  if (!user) return err("Unauthorized", 401);
  return user;
}

export function isResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}
