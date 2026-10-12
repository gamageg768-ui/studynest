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

  const existingTags = await sql`SELECT id, name, color FROM tags WHERE user_id = ${user.id}`;

  const prompt = `Note title: "${page.title}"
Note content:
${(page.content as string).slice(0, 2000)}

User's existing tags: ${JSON.stringify(existingTags.map((t: any) => ({ id: t.id, name: t.name })))}

Suggest up to 5 relevant tags for this note. Prefer existing tags when they fit.`;

  try {
    const raw = await callOllama(
      prompt,
      `You are a content classifier. Suggest relevant tags for the given note. Return ONLY valid JSON in this exact format, nothing else:
{"suggested":[{"tag_id":null,"name":"string","isNew":true,"color":"#hex"}]}
For existing tags: use their exact numeric id, set isNew to false. For new tags: tag_id must be null, isNew must be true, suggest a color hex. Max 5 suggestions.`
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
