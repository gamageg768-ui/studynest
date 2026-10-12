import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess } = await userCanAccess(notebookId, user.id);
  if (!canAccess) return err("Not found", 404);
  const events = await sql`
    SELECT se.*, u.display_name AS creator_name
    FROM study_events se JOIN users u ON u.id = se.created_by
    WHERE se.notebook_id = ${notebookId} ORDER BY se.scheduled_at ASC
  `;
  return ok({ events });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess, permission } = await userCanAccess(notebookId, user.id);
  if (!canAccess) return err("Not found", 404);
  if (permission !== "owner" && permission !== "admin" && permission !== "edit") return err("Forbidden", 403);

  const data = await req.json().catch(() => ({}));
  const title = ((data.title as string) || "").trim();
  const scheduledAt = (data.scheduled_at as string) || "";
  const durationMinutes = Number(data.duration_minutes) || 60;
  const agenda = ((data.agenda as string) || "").trim();
  if (!title || !scheduledAt) return err("title and scheduled_at required", 400);

  const [newEvent] = await sql`
    INSERT INTO study_events (notebook_id, created_by, title, scheduled_at, duration_minutes, agenda)
    VALUES (${notebookId}, ${user.id}, ${title}, ${scheduledAt}, ${durationMinutes}, ${agenda})
    RETURNING id
  `;

  // Notify all members
  try {
    const members = await sql`
      SELECT u.id FROM users u WHERE u.id = (SELECT owner_id FROM notebooks WHERE id = ${notebookId})
      UNION
      SELECT u.id FROM users u JOIN shares s ON s.shared_with_user_id = u.id WHERE s.notebook_id = ${notebookId}
    `;
    const [nb] = await sql`SELECT title FROM notebooks WHERE id = ${notebookId}`;
    const dt = new Date(scheduledAt).toLocaleString();
    for (const m of members) {
      if (m.id !== user.id) {
        await sql`
          INSERT INTO notifications (user_id, type, title, body, data)
          VALUES (${m.id}, ${"event"}, ${`Study session: ${title}`}, ${`${user.display_name} scheduled a session for ${dt}`}, ${JSON.stringify({ notebook_id: notebookId })})
        `;
      }
    }
  } catch {}

  return ok({ id: newEvent.id, title, scheduled_at: scheduledAt, duration_minutes: durationMinutes, agenda }, 201);
}
