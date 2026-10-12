import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  if (user.is_guest) return err("Guests cannot save quiz attempts", 403);

  const data = await req.json().catch(() => ({}));
  const notebook_id = Number(data.notebook_id);
  const score = Number(data.score);
  const total = Number(data.total);
  if (!notebook_id || total <= 0) return err("notebook_id and total are required", 400);

  const { canAccess } = await userCanAccess(notebook_id, user.id);
  if (!canAccess) return err("Notebook not found", 404);

  const [attempt] = await sql`
    INSERT INTO quiz_attempts (user_id, notebook_id, score, total) VALUES (${user.id}, ${notebook_id}, ${score}, ${total})
    RETURNING id
  `;
  return ok({ id: attempt.id }, 201);
}

export async function GET(req: NextRequest) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebook_id = Number(req.nextUrl.searchParams.get("notebook_id"));
  if (!notebook_id) return err("notebook_id is required", 400);

  const { canAccess } = await userCanAccess(notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);

  const attempts = await sql`
    SELECT * FROM quiz_attempts WHERE user_id = ${user.id} AND notebook_id = ${notebook_id}
    ORDER BY created_at DESC LIMIT 20
  `;
  return ok({ attempts });
}
