import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const db = getDb();
  const { canAccess } = userCanAccess(notebookId, user.id);
  if (!canAccess) return err("Not found", 404);
  const link = db.prepare("SELECT token, expires_at, created_at FROM public_links WHERE notebook_id = ?").get(notebookId) as any;
  return ok({ link: link || null });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const db = getDb();
  const nb = db.prepare("SELECT owner_id FROM notebooks WHERE id = ?").get(notebookId) as any;
  if (!nb || nb.owner_id !== user.id) return err("Forbidden", 403);
  const token = randomBytes(20).toString("hex");
  db.prepare(
    `INSERT INTO public_links (notebook_id, token, created_by)
     VALUES (?, ?, ?)
     ON CONFLICT(notebook_id) DO UPDATE SET token = excluded.token, created_at = CURRENT_TIMESTAMP`
  ).run(notebookId, token, user.id);
  return ok({ token });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const db = getDb();
  const nb = db.prepare("SELECT owner_id FROM notebooks WHERE id = ?").get(notebookId) as any;
  if (!nb || nb.owner_id !== user.id) return err("Forbidden", 403);
  db.prepare("DELETE FROM public_links WHERE notebook_id = ?").run(notebookId);
  return ok({ ok: true });
}
