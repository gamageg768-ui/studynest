import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess } = await userCanAccess(notebookId, user.id);
  if (!canAccess) return err("Not found", 404);
  const [link] = await sql`SELECT token, expires_at, created_at FROM public_links WHERE notebook_id = ${notebookId}`;
  return ok({ link: link || null });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const [nb] = await sql`SELECT owner_id FROM notebooks WHERE id = ${notebookId}`;
  if (!nb || nb.owner_id !== user.id) return err("Forbidden", 403);
  const token = randomBytes(20).toString("hex");
  await sql`
    INSERT INTO public_links (notebook_id, token, created_by)
    VALUES (${notebookId}, ${token}, ${user.id})
    ON CONFLICT(notebook_id) DO UPDATE SET token = EXCLUDED.token, created_at = NOW()
  `;
  return ok({ token });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const [nb] = await sql`SELECT owner_id FROM notebooks WHERE id = ${notebookId}`;
  if (!nb || nb.owner_id !== user.id) return err("Forbidden", 403);
  await sql`DELETE FROM public_links WHERE notebook_id = ${notebookId}`;
  return ok({ ok: true });
}
