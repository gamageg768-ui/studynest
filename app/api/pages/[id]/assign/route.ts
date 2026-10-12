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
  const assignment = db.prepare(
    `SELECT pa.*, u.display_name AS assignee_name FROM page_assignments pa
     JOIN users u ON u.id = pa.assigned_to WHERE pa.page_id = ?`
  ).get(pageId);
  return ok({ assignment: assignment || null });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const db = getDb();
  const page = db.prepare("SELECT notebook_id, title FROM pages WHERE id = ?").get(pageId) as any;
  if (!page) return err("Not found", 404);
  const { canAccess, permission } = userCanAccess(page.notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);
  if (permission !== "owner" && permission !== "admin") return err("Only owner/admin can assign pages", 403);

  const data = await req.json().catch(() => ({}));

  // Unassign
  if (data.assigned_to === null) {
    db.prepare("DELETE FROM page_assignments WHERE page_id = ?").run(pageId);
    return ok({ assignment: null });
  }

  const assignedTo = Number(data.assigned_to);
  const dueDate = (data.due_date as string) || null;
  const { canAccess: assigneeAccess } = userCanAccess(page.notebook_id, assignedTo);
  if (!assigneeAccess) return err("Assignee does not have access to this notebook", 400);

  db.prepare(
    `INSERT INTO page_assignments (page_id, assigned_to, assigned_by, due_date, status)
     VALUES (?, ?, ?, ?, 'assigned')
     ON CONFLICT(page_id) DO UPDATE SET assigned_to = excluded.assigned_to, assigned_by = excluded.assigned_by, due_date = excluded.due_date, status = 'assigned'`
  ).run(pageId, assignedTo, user.id, dueDate);

  // Notify assignee
  try {
    const assignee = db.prepare("SELECT display_name FROM users WHERE id = ?").get(assignedTo) as any;
    db.prepare(
      "INSERT INTO notifications (user_id, type, title, body, data) VALUES (?, 'assignment', ?, ?, ?)"
    ).run(assignedTo, `Page assigned: "${page.title}"`, `${user.display_name} assigned you a page${dueDate ? ` (due ${dueDate})` : ""}`, JSON.stringify({ notebook_id: page.notebook_id, page_id: pageId }));
  } catch {}

  return ok({ page_id: pageId, assigned_to: assignedTo, due_date: dueDate, status: "assigned" });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const db = getDb();
  const page = db.prepare("SELECT notebook_id FROM pages WHERE id = ?").get(pageId) as any;
  if (!page) return err("Not found", 404);
  const { permission } = userCanAccess(page.notebook_id, user.id);
  if (permission !== "owner" && permission !== "admin") return err("Forbidden", 403);
  db.prepare("DELETE FROM page_assignments WHERE page_id = ?").run(pageId);
  return ok({ ok: true });
}
