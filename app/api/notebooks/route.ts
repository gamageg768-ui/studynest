import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  const user = await auth(req);
  if (isResponse(user)) return user;

  const owned = await sql`
    SELECT id, title, description, color, icon, owner_id, is_pinned, created_at, updated_at,
           'owner' AS permission
    FROM notebooks WHERE owner_id = ${user.id} ORDER BY is_pinned DESC, updated_at DESC
  `;

  const shared = await sql`
    SELECT n.id, n.title, n.description, n.color, n.icon, n.owner_id,
           n.created_at, n.updated_at, s.permission, u.display_name AS owner_name
    FROM notebooks n
    JOIN shares s ON s.notebook_id = n.id
    JOIN users u ON u.id = n.owner_id
    WHERE s.shared_with_user_id = ${user.id}
    ORDER BY n.updated_at DESC
  `;

  return ok({ owned, shared });
}

export async function POST(req: NextRequest) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const data = await req.json().catch(() => ({}));
  const title = ((data.title as string) || "").trim();
  if (!title) return err("Title is required", 400);
  const description = ((data.description as string) || "").trim();
  const color = (data.color as string) || "#fef3c7";
  const icon = (data.icon as string) || "📒";

  const [notebook] = await sql`
    INSERT INTO notebooks (owner_id, title, description, color, icon) VALUES (${user.id}, ${title}, ${description}, ${color}, ${icon})
    RETURNING *
  `;
  return ok(notebook, 201);
}
