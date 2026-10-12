import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const data = await req.json().catch(() => ({}));
  const duration_seconds = Number(data.duration_seconds);
  if (!duration_seconds || duration_seconds <= 0) return err("duration_seconds must be positive", 400);

  const notebook_id = data.notebook_id ? Number(data.notebook_id) : null;

  if (notebook_id) {
    const { canAccess } = await userCanAccess(notebook_id, user.id);
    if (!canAccess) return err("Notebook not found", 404);
  }

  const [session] = await sql`
    INSERT INTO study_sessions (user_id, notebook_id, duration_seconds) VALUES (${user.id}, ${notebook_id}, ${duration_seconds})
    RETURNING id, created_at
  `;
  return ok({ id: session.id, created_at: session.created_at }, 201);
}
