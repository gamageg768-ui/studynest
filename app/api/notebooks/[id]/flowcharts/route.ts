import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess } = await userCanAccess(notebookId, user.id);
  if (!canAccess) return err("Not found", 404);
  const flowcharts = await sql`
    SELECT id, notebook_id, title, created_at, updated_at FROM flowcharts WHERE notebook_id = ${notebookId} ORDER BY updated_at DESC
  `;
  return ok({ flowcharts });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess, permission } = await userCanAccess(notebookId, user.id);
  if (!canAccess || permission === "read") return err("Permission denied", 403);

  const data = await req.json().catch(() => ({}));
  const title = ((data.title as string) || "").trim();
  if (!title) return err("title required", 400);
  const source = ((data.source as string) || "flowchart TD\n    A[Start] --> B[End]").trim();

  const [row] = await sql`
    INSERT INTO flowcharts (notebook_id, title, source) VALUES (${notebookId}, ${title}, ${source})
    RETURNING *
  `;
  return ok(row, 201);
}
