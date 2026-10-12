import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const db = getDb();
  const nb = db.prepare("SELECT owner_id FROM notebooks WHERE id = ?").get(notebookId) as any;
  if (!nb || nb.owner_id !== user.id) return err("Forbidden", 403);

  const shares = db
    .prepare(
      `SELECT s.id, s.permission, u.username, u.display_name, u.id AS user_id
       FROM shares s JOIN users u ON u.id = s.shared_with_user_id
       WHERE s.notebook_id = ? ORDER BY u.display_name`
    )
    .all(notebookId);
  return ok({ shares });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const db = getDb();
  const nb = db.prepare("SELECT owner_id FROM notebooks WHERE id = ?").get(notebookId) as any;
  if (!nb || nb.owner_id !== user.id) return err("Forbidden", 403);

  const data = await req.json().catch(() => ({}));
  const targetUsername = ((data.username as string) || "").trim().toLowerCase();
  const permission = (data.permission as string) || "read";
  if (!["read", "edit", "admin"].includes(permission)) return err("Permission must be 'read', 'edit', or 'admin'", 400);
  if (!targetUsername) return err("Username is required", 400);

  const target = db
    .prepare("SELECT id, username, display_name FROM users WHERE username = ?")
    .get(targetUsername) as any;
  if (!target) return err(`No user named '${targetUsername}'`, 404);
  if (target.id === user.id) return err("You can't share a notebook with yourself", 400);

  try {
    db.prepare(
      `INSERT INTO shares (notebook_id, shared_with_user_id, permission)
       VALUES (?, ?, ?)
       ON CONFLICT(notebook_id, shared_with_user_id)
       DO UPDATE SET permission = excluded.permission`
    ).run(notebookId, target.id, permission);
  } catch {
    return err("Could not share notebook", 500);
  }

  // Notify the recipient
  const nbInfo = db.prepare("SELECT title FROM notebooks WHERE id = ?").get(notebookId) as any;
  try {
    db.prepare(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES (?, 'share', ?, ?, ?)`
    ).run(
      target.id,
      `${nbInfo?.title ?? "A notebook"} shared with you`,
      `${user.display_name} shared with ${permission} access`,
      JSON.stringify({ notebook_id: notebookId, permission })
    );
  } catch {}

  return ok({
    ok: true,
    user: {
      user_id: target.id,
      username: target.username,
      display_name: target.display_name,
      permission,
    },
  });
}
