import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";
import { callOllama } from "@/lib/ollama";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const data = await req.json().catch(() => ({}));
  const db = getDb();

  let content = "";
  let sourceTitle = "";

  if (data.page_id) {
    const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(Number(data.page_id)) as any;
    if (!page) return err("Not found", 404);
    const { canAccess } = userCanAccess(page.notebook_id, user.id);
    if (!canAccess) return err("Not found", 404);
    content = (page.content as string).slice(0, 3000);
    sourceTitle = page.title;
  } else if (data.notebook_id) {
    const { canAccess } = userCanAccess(Number(data.notebook_id), user.id);
    if (!canAccess) return err("Not found", 404);
    const pages = db.prepare("SELECT title, content FROM pages WHERE notebook_id = ?").all(Number(data.notebook_id)) as any[];
    if (!pages.length) return err("No pages found", 404);
    content = pages.map((p: any) => `## ${p.title}\n${p.content}`).join("\n\n").slice(0, 3000);
    sourceTitle = "notebook";
  } else {
    return err("page_id or notebook_id required", 400);
  }

  try {
    let raw = await callOllama(
      `Extract key concepts and their relationships from notes titled '${sourceTitle}':\n\n${content}`,
      "You are a Mermaid diagram expert. Output ONLY valid Mermaid graph syntax. Start with exactly 'graph TD' on the first line. Show concepts as nodes and relationships as labeled edges. Use short node labels (max 4 words). Keep under 15 nodes. No markdown code fences, no explanations, no extra text."
    );
    raw = raw.replace(/```[a-z]*\n?/g, "").trim();
    if (!/^graph\s/i.test(raw)) raw = "graph TD\n" + raw;

    const conceptsRaw = await callOllama(
      `List the key concepts from these notes. Return ONLY a JSON array of strings, no extra text:\n\n${content.slice(0, 1500)}`,
      'You are a content analyst. Return only a JSON array of concept name strings. Example: ["Photosynthesis","Chlorophyll","ATP"]'
    );
    let concepts: string[] = [];
    try {
      const cleaned = conceptsRaw.replace(/```[a-z]*\n?/g, "").trim();
      const startIdx = cleaned.indexOf("[");
      const endIdx = cleaned.lastIndexOf("]");
      if (startIdx !== -1 && endIdx !== -1) {
        concepts = JSON.parse(cleaned.slice(startIdx, endIdx + 1));
      }
      if (!Array.isArray(concepts)) concepts = [];
    } catch { concepts = []; }

    return ok({ mermaid: raw, concepts });
  } catch (e: any) {
    return err(e.message, 503);
  }
}
