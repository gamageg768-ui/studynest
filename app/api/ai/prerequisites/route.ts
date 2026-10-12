import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";
import { callOllama } from "@/lib/ollama";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const data = await req.json().catch(() => ({}));

  let content = "";
  let sourceTitle = "";

  if (data.page_id) {
    const [page] = await sql`SELECT * FROM pages WHERE id = ${Number(data.page_id)}`;
    if (!page) return err("Not found", 404);
    const { canAccess } = await userCanAccess(page.notebook_id, user.id);
    if (!canAccess) return err("Not found", 404);
    content = (page.content as string).slice(0, 3000);
    sourceTitle = page.title;
  } else if (data.notebook_id) {
    const { canAccess } = await userCanAccess(Number(data.notebook_id), user.id);
    if (!canAccess) return err("Not found", 404);
    const pages = await sql`SELECT title, content FROM pages WHERE notebook_id = ${Number(data.notebook_id)}`;
    if (!pages.length) return err("No pages found", 404);
    content = pages.map((p: any) => `## ${p.title}\n${p.content}`).join("\n\n").slice(0, 3000);
    sourceTitle = "notebook";
  } else {
    return err("page_id or notebook_id required", 400);
  }

  try {
    const raw = await callOllama(
      `Analyze this study material titled '${sourceTitle}' and list prerequisite knowledge needed:\n\n${content}`,
      `You are an educational curriculum expert. List what a student must know BEFORE studying this material. Return ONLY valid JSON in this exact format, nothing else:
{"prerequisites":[{"concept":"string","importance":"required"}]}
Use "required" for foundational concepts without which the material is incomprehensible. Use "helpful" for supporting knowledge that aids understanding. Limit to 8 items.`
    );
    const cleaned = raw.replace(/```[a-z]*\n?/g, "").trim();
    const startIdx = cleaned.indexOf("{");
    const endIdx = cleaned.lastIndexOf("}");
    if (startIdx === -1 || endIdx === -1) return err("AI returned invalid data. Try again.", 503);
    const parsed = JSON.parse(cleaned.slice(startIdx, endIdx + 1));
    return ok(parsed);
  } catch (e: any) {
    if (e instanceof SyntaxError) return err("AI returned invalid data. Try again.", 503);
    return err(e.message, 503);
  }
}
