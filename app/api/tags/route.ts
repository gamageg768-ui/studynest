import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const tags = await sql`
    SELECT t.*, COUNT(pt.page_id) AS usage_count
    FROM tags t LEFT JOIN page_tags pt ON pt.tag_id = t.id
    WHERE t.user_id = ${user.id}
    GROUP BY t.id ORDER BY t.name
  `;
  return ok({ tags });
}

export async function POST(req: NextRequest) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const data = await req.json().catch(() => ({}));
  const name = ((data.name as string) || "").trim();
  if (!name) return err("Tag name is required", 400);
  const color = (data.color as string) || "#6366f1";

  try {
    const [tag] = await sql`
      INSERT INTO tags (user_id, name, color) VALUES (${user.id}, ${name}, ${color})
      RETURNING *
    `;
    return ok(tag, 201);
  } catch {
    return err("Tag already exists", 409);
  }
}
