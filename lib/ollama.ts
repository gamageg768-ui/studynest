import Groq from "groq-sdk";

const GROQ_MODEL = process.env.GROQ_MODEL || "llama3-70b-8192";

let _groq: Groq | null = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

export async function callOllama(prompt: string, system?: string): Promise<string> {
  const messages: Groq.Chat.ChatCompletionMessageParam[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const completion = await getGroq().chat.completions.create({
    messages,
    model: GROQ_MODEL,
    temperature: 0.7,
    max_tokens: 2048,
  });

  return (completion.choices[0]?.message?.content || "").trim();
}

export function fetchPageContent(
  db: import("better-sqlite3").Database,
  pageId: number,
  userId: number,
  userCanAccess: (nbId: number, userId: number) => { canAccess: boolean; permission: string }
): { page: any; error?: string } {
  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId) as any;
  if (!page) return { page: null, error: "Not found" };
  const { canAccess } = userCanAccess(page.notebook_id, userId);
  if (!canAccess) return { page: null, error: "Not found" };
  return { page };
}
