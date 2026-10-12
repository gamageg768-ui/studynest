import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";
import { callOllama } from "@/lib/ollama";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const data = await req.json().catch(() => ({}));
  const notebookId = Number(data.notebook_id);
  if (!notebookId) return err("notebook_id required", 400);
  const { canAccess } = await userCanAccess(notebookId, user.id);
  if (!canAccess) return err("Not found", 404);

  const [nb] = await sql`SELECT title FROM notebooks WHERE id = ${notebookId}`;
  const pages = await sql`SELECT title, content FROM pages WHERE notebook_id = ${notebookId} ORDER BY created_at`;

  if (!pages.length) return err("No pages in this notebook", 400);
  const combined = pages
    .filter((p: any) => (p.content || "").trim())
    .map((p: any) => `## ${p.title}\n${p.content}`)
    .join("\n\n---\n\n");
  if (!combined.trim()) return err("All pages are empty", 400);

  try {
    const guide = await callOllama(
      `Create a study guide for the notebook '${nb.title}' from these notes:\n\n${combined}`,
      "You are an expert study guide creator. Build a clean, well-organized study guide in markdown with sections: Key Concepts, Definitions, Important Examples, and Practice Questions. Keep it under 600 words."
    );
    return ok({ guide });
  } catch (e: any) {
    return err(e.message, 503);
  }
}
