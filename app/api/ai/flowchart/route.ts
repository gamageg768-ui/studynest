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
  let nbId: number;

  if (data.page_id) {
    const [page] = await sql`SELECT * FROM pages WHERE id = ${Number(data.page_id)}`;
    if (!page) return err("Not found", 404);
    const { canAccess } = await userCanAccess(page.notebook_id, user.id);
    if (!canAccess) return err("Not found", 404);
    content = page.content;
    sourceTitle = page.title;
    nbId = page.notebook_id;
  } else if (data.description && data.notebook_id) {
    const { canAccess } = await userCanAccess(Number(data.notebook_id), user.id);
    if (!canAccess) return err("Not found", 404);
    content = data.description as string;
    sourceTitle = (data.description as string).slice(0, 60);
    nbId = Number(data.notebook_id);
  } else {
    return err("page_id or (description + notebook_id) required", 400);
  }

  const prompt = data.description && !data.page_id
    ? `Create a Mermaid flowchart for: ${content.slice(0, 2000)}`
    : `Create a Mermaid flowchart from these notes titled '${sourceTitle}':\n\n${content.slice(0, 2000)}`;

  try {
    let raw = await callOllama(
      prompt,
      "You are a Mermaid diagram expert. Output ONLY valid Mermaid flowchart syntax. Start with exactly 'flowchart TD' on the first line. No markdown code fences, no explanations, no extra text. Use short descriptive node labels. Keep it under 20 nodes."
    );
    raw = raw.replace(/```[a-z]*\n?/g, "").trim();
    if (!/^flowchart\s/i.test(raw)) raw = "flowchart TD\n" + raw;
    return ok({ source: raw, suggested_title: `Flowchart – ${sourceTitle}`, notebook_id: nbId! });
  } catch (e: any) {
    return err(e.message, 503);
  }
}
