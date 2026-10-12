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
  const [assignment] = await sql`
    SELECT pa.*, u.display_name AS assignee_name FROM page_assignments pa
    JOIN users u ON u.id = pa.assigned_to WHERE pa.page_id = ${pageId}
  `;
  return ok({ assignment: assignment || null });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const [page] = await sql`SELECT notebook_id, title FROM pages WHERE id = ${pageId}`;
  if (!page) return err("Not found", 404);
  const { canAccess, permission } = await userCanAccess(page.notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);
  if (permission !== "owner" && permission !== "admin") return err("Only owner/admin can assign pages", 403);

  const data = await req.json().catch(() => ({}));

  // Unassign
  if (data.assigned_to === null) {
    await sql`DELETE FROM page_assignments WHERE page_id = ${pageId}`;
    return ok({ assignment: null });
  }

  const assignedTo = Number(data.assigned_to);
  const dueDate = (data.due_date as string) || null;
  const { canAccess: assigneeAccess } = await userCanAccess(page.notebook_id, assignedTo);
  if (!assigneeAccess) return err("Assignee does not have access to this notebook", 400);

  await sql`
    INSERT INTO page_assignments (page_id, assigned_to, assigned_by, due_date, status)
    VALUES (${pageId}, ${assignedTo}, ${user.id}, ${dueDate}, ${"assigned"})
    ON CONFLICT(page_id) DO UPDATE SET assigned_to = EXCLUDED.assigned_to, assigned_by = EXCLUDED.assigned_by, due_date = EXCLUDED.due_date, status = 'assigned'
  `;

  // Notify assignee
  try {
    await sql`
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (${assignedTo}, ${"assignment"}, ${`Page assigned: "${page.title}"`}, ${`${user.display_name} assigned you a page${dueDate ? ` (due ${dueDate})` : ""}`}, ${JSON.stringify({ notebook_id: page.notebook_id, page_id: pageId })})
    `;
  } catch {}

  return ok({ page_id: pageId, assigned_to: assignedTo, due_date: dueDate, status: "assigned" });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const [page] = await sql`SELECT notebook_id FROM pages WHERE id = ${pageId}`;
  if (!page) return err("Not found", 404);
  const { permission } = await userCanAccess(page.notebook_id, user.id);
  if (permission !== "owner" && permission !== "admin") return err("Forbidden", 403);
  await sql`DELETE FROM page_assignments WHERE page_id = ${pageId}`;
  return ok({ ok: true });
}
