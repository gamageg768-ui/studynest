import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const [nb] = await sql`SELECT owner_id FROM notebooks WHERE id = ${notebookId}`;
  if (!nb || nb.owner_id !== user.id) return err("Forbidden", 403);

  const shares = await sql`
    SELECT s.id, s.permission, u.username, u.display_name, u.id AS user_id
    FROM shares s JOIN users u ON u.id = s.shared_with_user_id
    WHERE s.notebook_id = ${notebookId} ORDER BY u.display_name
  `;
  return ok({ shares });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const [nb] = await sql`SELECT owner_id FROM notebooks WHERE id = ${notebookId}`;
  if (!nb || nb.owner_id !== user.id) return err("Forbidden", 403);

  const data = await req.json().catch(() => ({}));
  const targetUsername = ((data.username as string) || "").trim().toLowerCase();
  const permission = (data.permission as string) || "read";
  if (!["read", "edit", "admin"].includes(permission)) return err("Permission must be 'read', 'edit', or 'admin'", 400);
  if (!targetUsername) return err("Username is required", 400);

  const [target] = await sql`SELECT id, username, display_name FROM users WHERE username = ${targetUsername}`;
  if (!target) return err(`No user named '${targetUsername}'`, 404);
  if (target.id === user.id) return err("You can't share a notebook with yourself", 400);

  try {
    await sql`
      INSERT INTO shares (notebook_id, shared_with_user_id, permission)
      VALUES (${notebookId}, ${target.id}, ${permission})
      ON CONFLICT(notebook_id, shared_with_user_id)
      DO UPDATE SET permission = EXCLUDED.permission
    `;
  } catch {
    return err("Could not share notebook", 500);
  }

  // Notify the recipient
  const [nbInfo] = await sql`SELECT title FROM notebooks WHERE id = ${notebookId}`;
  try {
    await sql`
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (${target.id}, ${"share"}, ${`${nbInfo?.title ?? "A notebook"} shared with you`}, ${`${user.display_name} shared with ${permission} access`}, ${JSON.stringify({ notebook_id: notebookId, permission })})
    `;
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
