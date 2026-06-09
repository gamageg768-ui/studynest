import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const db = getDb();

  const owned = db
    .prepare(
      `SELECT id, title, description, color, icon, owner_id, is_pinned, created_at, updated_at,
              'owner' AS permission
       FROM notebooks WHERE owner_id = ? ORDER BY is_pinned DESC, updated_at DESC`
    )
    .all(user.id);

  const shared = db
    .prepare(
      `SELECT n.id, n.title, n.description, n.color, n.icon, n.owner_id,
              n.created_at, n.updated_at, s.permission, u.display_name AS owner_name
       FROM notebooks n
       JOIN shares s ON s.notebook_id = n.id
       JOIN users u ON u.id = n.owner_id
       WHERE s.shared_with_user_id = ?
       ORDER BY n.updated_at DESC`
    )
    .all(user.id);

  return ok({ owned, shared });
}

export async function POST(req: NextRequest) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const data = await req.json().catch(() => ({}));
  const title = ((data.title as string) || "").trim();
  if (!title) return err("Title is required", 400);
  const description = ((data.description as string) || "").trim();
  const color = (data.color as string) || "#fef3c7";
  const icon = (data.icon as string) || "📒";

  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO notebooks (owner_id, title, description, color, icon) VALUES (?, ?, ?, ?, ?)"
    )
    .run(user.id, title, description, color, icon);
  const notebook = db
    .prepare("SELECT * FROM notebooks WHERE id = ?")
    .get(result.lastInsertRowid);
  return ok(notebook, 201);
}
