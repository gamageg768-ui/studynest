import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const db = getDb();
  const tags = db
    .prepare(
      `SELECT t.*, COUNT(pt.page_id) AS usage_count
       FROM tags t LEFT JOIN page_tags pt ON pt.tag_id = t.id
       WHERE t.user_id = ?
       GROUP BY t.id ORDER BY t.name`
    )
    .all(user.id);
  return ok({ tags });
}

export async function POST(req: NextRequest) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const data = await req.json().catch(() => ({}));
  const name = ((data.name as string) || "").trim();
  if (!name) return err("Tag name is required", 400);
  const color = (data.color as string) || "#6366f1";

  const db = getDb();
  try {
    const result = db
      .prepare("INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)")
      .run(user.id, name, color);
    const tag = db.prepare("SELECT * FROM tags WHERE id = ?").get(result.lastInsertRowid);
    return ok(tag, 201);
  } catch {
    return err("Tag already exists", 409);
  }
}
