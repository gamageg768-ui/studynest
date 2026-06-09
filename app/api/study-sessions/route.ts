import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const data = await req.json().catch(() => ({}));
  const duration_seconds = Number(data.duration_seconds);
  if (!duration_seconds || duration_seconds <= 0) return err("duration_seconds must be positive", 400);

  const notebook_id = data.notebook_id ? Number(data.notebook_id) : null;
  const db = getDb();

  if (notebook_id) {
    const { canAccess } = userCanAccess(notebook_id, user.id);
    if (!canAccess) return err("Notebook not found", 404);
  }

  const result = db
    .prepare("INSERT INTO study_sessions (user_id, notebook_id, duration_seconds) VALUES (?, ?, ?)")
    .run(user.id, notebook_id, duration_seconds);
  return ok({ id: result.lastInsertRowid, created_at: new Date().toISOString() }, 201);
}
