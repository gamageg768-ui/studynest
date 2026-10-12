import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { auth, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return ok({ results: [] });
  const term = `%${q}%`;
  const results = await sql`
    SELECT p.id, p.title, p.notebook_id,
           substr(p.content, 1, 200) AS preview,
           p.updated_at,
           n.title AS notebook_title, n.icon AS notebook_icon
    FROM pages p
    JOIN notebooks n ON n.id = p.notebook_id
    LEFT JOIN shares s ON s.notebook_id = n.id AND s.shared_with_user_id = ${user.id}
    WHERE (n.owner_id = ${user.id} OR s.id IS NOT NULL)
      AND (p.title ILIKE ${term} OR p.content ILIKE ${term})
    ORDER BY p.updated_at DESC
    LIMIT 50
  `;
  return ok({ results });
}
