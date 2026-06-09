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
  const question = ((data.question as string) || "").trim();
  if (!pageId || !question) return err("page_id and question required", 400);

  const db = getDb();
  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId) as any;
  if (!page) return err("Not found", 404);
  const { canAccess } = userCanAccess(page.notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);

  try {
    const answer = await callOllama(
      `Notes (titled '${page.title}'):\n${page.content}\n\nStudent's question: ${question}`,
      "You are a patient tutor. Explain the student's question in simple, friendly terms using examples and analogies. Reference their notes when relevant. Keep your answer under 250 words."
    );
    return ok({ answer });
  } catch (e: any) {
    return err(e.message, 503);
  }
}
