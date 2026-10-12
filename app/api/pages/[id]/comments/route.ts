import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const [page] = await sql`SELECT notebook_id FROM pages WHERE id = ${pageId}`;
  if (!page) return err("Not found", 404);
  const { canAccess } = await userCanAccess(page.notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);
  const comments = await sql`SELECT * FROM page_comments WHERE page_id = ${pageId} ORDER BY created_at ASC`;
  return ok({ comments });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const [page] = await sql`SELECT notebook_id FROM pages WHERE id = ${pageId}`;
  if (!page) return err("Not found", 404);
  const { canAccess } = await userCanAccess(page.notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);

  const data = await req.json().catch(() => ({}));
  const body = ((data.body as string) || "").trim();
  const anchorText = ((data.anchor_text as string) || "").trim();
  if (!body) return err("Comment body required", 400);

  const [newComment] = await sql`
    INSERT INTO page_comments (page_id, user_id, display_name, anchor_text, body)
    VALUES (${pageId}, ${user.id}, ${user.display_name}, ${anchorText}, ${body})
    RETURNING id
  `;

  // Notify other members
  try {
    const [pg] = await sql`SELECT title FROM pages WHERE id = ${pageId}`;
    const accessors = await sql`
      SELECT u.id FROM users u WHERE u.id = (SELECT owner_id FROM notebooks WHERE id = ${page.notebook_id})
      UNION
      SELECT u.id FROM users u JOIN shares s ON s.shared_with_user_id = u.id WHERE s.notebook_id = ${page.notebook_id}
    `;
    for (const a of accessors) {
      if (a.id !== user.id) {
        await sql`
          INSERT INTO notifications (user_id, type, title, body, data)
          VALUES (${a.id}, ${"comment"}, ${`New comment on "${pg?.title}"`}, ${`${user.display_name}: ${body.slice(0, 80)}`}, ${JSON.stringify({ notebook_id: page.notebook_id, page_id: pageId })})
        `;
      }
    }
  } catch {}

  return ok({ id: newComment.id, page_id: pageId, user_id: user.id, display_name: user.display_name, anchor_text: anchorText, body, resolved: false }, 201);
}
