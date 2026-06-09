import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";
import { callOllama } from "@/lib/ollama";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const data = await req.json().catch(() => ({}));
  const pageId = Number(data.page_id);
  const n = Math.max(1, Math.min(Number(data.count || 5), 10));
  if (!pageId) return err("page_id required", 400);

  const db = getDb();
  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId) as any;
  if (!page) return err("Not found", 404);
  const { canAccess } = userCanAccess(page.notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);
  if (!(page.content || "").trim()) return err("Page is empty", 400);

  try {
    const raw = await callOllama(
      `Create exactly ${n} multiple-choice quiz questions based on these notes titled '${page.title}'.
Return ONLY a valid JSON array, no other text, no markdown, no explanation.
Format: [{"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"correct":0}]
"correct" is the 0-indexed position of the correct option (0=A, 1=B, 2=C, 3=D).

Notes:
${page.content}`,
      "You are a quiz generator. Return ONLY a JSON array. Do not include any text before or after the JSON."
    );

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) {
      // Fallback: return as plain text quiz for backwards compatibility
      return ok({ quiz: raw, questions: null, notebook_id: page.notebook_id });
    }

    const questions = JSON.parse(match[0]);
    return ok({ questions, notebook_id: page.notebook_id, quiz: null });
  } catch (e: any) {
    return err(e.message, 503);
  }
}
