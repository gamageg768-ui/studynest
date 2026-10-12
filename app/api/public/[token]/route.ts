import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { ok, err } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const [link] = await sql`
    SELECT notebook_id, expires_at FROM public_links WHERE token = ${params.token}
  `;
  if (!link) return err("Invalid or expired link", 404);
  if (link.expires_at && new Date(link.expires_at) < new Date()) return err("Link has expired", 410);

  const [nb] = await sql`
    SELECT id, title, description, color, icon, owner_id FROM notebooks WHERE id = ${link.notebook_id}
  `;
  if (!nb) return err("Not found", 404);

  const [owner] = await sql`SELECT display_name FROM users WHERE id = ${nb.owner_id}`;
  const pages = await sql`
    SELECT id, title, content, updated_at FROM pages WHERE notebook_id = ${link.notebook_id} ORDER BY created_at
  `;

  return ok({ notebook: { ...nb, owner_name: owner?.display_name }, pages });
}
