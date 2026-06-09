const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

export async function callOllama(prompt: string, system?: string): Promise<string> {
  const payload: Record<string, unknown> = {
    model: OLLAMA_MODEL,
    prompt,
    stream: false,
  };
  if (system) payload.system = system;

  let r: Response;
  try {
    r = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e: any) {
    if (e?.name === "TimeoutError") {
      throw new Error("Ollama timed out. Try a smaller model or shorter input.");
    }
    throw new Error(
      `Could not reach Ollama at ${OLLAMA_URL}. Is it running? Try \`ollama serve\`.`
    );
  }

  if (!r.ok) throw new Error(`Ollama returned HTTP ${r.status}`);
  const data = await r.json();
  return (data.response || "").trim();
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
