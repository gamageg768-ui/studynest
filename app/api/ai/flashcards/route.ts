import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";
import { callOllama } from "@/lib/ollama";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const data = await req.json().catch(() => ({}));
  const n = Math.max(3, Math.min(Number(data.count || 8), 20));
  const db = getDb();

  let content = "";
  let sourceTitle = "";
  let nbId: number;

  if (data.page_id) {
    const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(Number(data.page_id)) as any;
    if (!page) return err("Not found", 404);
    const { canAccess } = userCanAccess(page.notebook_id, user.id);
    if (!canAccess) return err("Not found", 404);
    content = page.content;
    sourceTitle = page.title;
    nbId = page.notebook_id;
  } else if (data.notebook_id) {
    const { canAccess } = userCanAccess(Number(data.notebook_id), user.id);
    if (!canAccess) return err("Not found", 404);
    const pages = db
      .prepare("SELECT title, content FROM pages WHERE notebook_id = ? ORDER BY created_at")
      .all(Number(data.notebook_id)) as any[];
    const nb = db.prepare("SELECT title FROM notebooks WHERE id = ?").get(Number(data.notebook_id)) as any;
    content = pages
      .filter((p) => (p.content || "").trim())
      .map((p) => `## ${p.title}\n${p.content}`)
      .join("\n\n");
    sourceTitle = nb?.title || "notebook";
    nbId = Number(data.notebook_id);
  } else {
    return err("page_id or notebook_id required", 400);
  }

  if (!(content || "").trim()) return err("Content is empty", 400);

  try {
    let raw = await callOllama(
      `Generate ${n} flashcards from these notes titled '${sourceTitle}'. Front = question or term. Back = answer or definition.\n\n${content.slice(0, 3000)}`,
      "You are a flashcard generator. Output ONLY a valid JSON array of objects, each with 'front' and 'back' string keys. No markdown code fences, no extra text."
    );
    raw = raw.replace(/```[a-z]*\n?/g, "").trim();
    const m = raw.match(/\[[\s\S]*\]/);
    if (m) raw = m[0];
    const cards = JSON.parse(raw);
    if (!Array.isArray(cards)) throw new Error("not a list");
    return ok({ cards, suggested_title: `Flashcards – ${sourceTitle}`, notebook_id: nbId! });
  } catch (e: any) {
    if (e.message?.includes("Ollama") || e.message?.includes("reach")) return err(e.message, 503);
    return err("AI returned malformed JSON. Please try again.", 500);
  }
}
