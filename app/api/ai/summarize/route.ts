import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";
import { callOllama } from "@/lib/ollama";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const data = await req.json().catch(() => ({}));
  const pageId = Number(data.page_id);
  if (!pageId) return err("page_id required", 400);

  const [page] = await sql`SELECT * FROM pages WHERE id = ${pageId}`;
  if (!page) return err("Not found", 404);
  const { canAccess } = await userCanAccess(page.notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);
  if (!(page.content || "").trim()) return err("Page is empty", 400);

  try {
    const summary = await callOllama(
      `Summarize these notes titled '${page.title}':\n\n${page.content}`,
      "You are a friendly study assistant for students. Summarize notes clearly and concisely using bullet points. Highlight the key concepts and definitions. Keep it under 200 words."
    );
    return ok({ summary });
  } catch (e: any) {
    return err(e.message, 503);
  }
}
