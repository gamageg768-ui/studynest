import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const db = getDb();
  const page = db.prepare("SELECT notebook_id FROM pages WHERE id = ?").get(pageId) as any;
  if (!page) return err("Not found", 404);
  const { canAccess } = userCanAccess(page.notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);
  const comments = db.prepare(
    "SELECT * FROM page_comments WHERE page_id = ? ORDER BY created_at ASC"
  ).all(pageId);
  return ok({ comments });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const db = getDb();
  const page = db.prepare("SELECT notebook_id FROM pages WHERE id = ?").get(pageId) as any;
  if (!page) return err("Not found", 404);
  const { canAccess } = userCanAccess(page.notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);

  const data = await req.json().catch(() => ({}));
  const body = ((data.body as string) || "").trim();
  const anchorText = ((data.anchor_text as string) || "").trim();
  if (!body) return err("Comment body required", 400);

  const result = db.prepare(
    "INSERT INTO page_comments (page_id, user_id, display_name, anchor_text, body) VALUES (?, ?, ?, ?, ?)"
  ).run(pageId, user.id, user.display_name, anchorText, body);

  // Notify other members
  try {
    const nb = db.prepare("SELECT title, owner_id FROM notebooks WHERE id = ?").get(page.notebook_id) as any;
    const pg = db.prepare("SELECT title FROM pages WHERE id = ?").get(pageId) as any;
    const accessors = db.prepare(
      `SELECT u.id FROM users u WHERE u.id = (SELECT owner_id FROM notebooks WHERE id = ?)
       UNION
       SELECT u.id FROM users u JOIN shares s ON s.shared_with_user_id = u.id WHERE s.notebook_id = ?`
    ).all(page.notebook_id, page.notebook_id) as any[];
    for (const a of accessors) {
      if (a.id !== user.id) {
        db.prepare(
          "INSERT INTO notifications (user_id, type, title, body, data) VALUES (?, 'comment', ?, ?, ?)"
        ).run(a.id, `New comment on "${pg?.title}"`, `${user.display_name}: ${body.slice(0, 80)}`, JSON.stringify({ notebook_id: page.notebook_id, page_id: pageId }));
      }
    }
  } catch {}

  return ok({ id: Number(result.lastInsertRowid), page_id: pageId, user_id: user.id, display_name: user.display_name, anchor_text: anchorText, body, resolved: 0 }, 201);
}
