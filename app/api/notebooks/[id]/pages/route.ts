import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess, permission } = userCanAccess(notebookId, user.id);
  if (!canAccess || !["owner", "edit"].includes(permission)) return err("Forbidden", 403);

  const data = await req.json().catch(() => ({}));
  const title = ((data.title as string) || "Untitled").trim() || "Untitled";
  const content = (data.content as string) || "";

  const db = getDb();
  const result = db
    .prepare("INSERT INTO pages (notebook_id, title, content) VALUES (?, ?, ?)")
    .run(notebookId, title, content);
  db.prepare("UPDATE notebooks SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(notebookId);
  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(result.lastInsertRowid);
  return ok(page, 201);
}
