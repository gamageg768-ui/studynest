import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ok, err } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const db = getDb();
  const link = db.prepare(
    "SELECT notebook_id, expires_at FROM public_links WHERE token = ?"
  ).get(params.token) as any;
  if (!link) return err("Invalid or expired link", 404);
  if (link.expires_at && new Date(link.expires_at) < new Date()) return err("Link has expired", 410);

  const nb = db.prepare(
    "SELECT id, title, description, color, icon, owner_id FROM notebooks WHERE id = ?"
  ).get(link.notebook_id) as any;
  if (!nb) return err("Not found", 404);

  const owner = db.prepare("SELECT display_name FROM users WHERE id = ?").get(nb.owner_id) as any;
  const pages = db.prepare(
    "SELECT id, title, content, updated_at FROM pages WHERE notebook_id = ? ORDER BY created_at"
  ).all(link.notebook_id) as any[];

  return ok({ notebook: { ...nb, owner_name: owner?.display_name }, pages });
}
