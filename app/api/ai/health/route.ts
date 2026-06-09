import { NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

export async function GET() {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await r.json();
    const models = (data.models || []).map((m: any) => m.name || "");
    const model_available = models.some((m: string) => m.includes(OLLAMA_MODEL));
    return NextResponse.json({ ok: true, ollama_url: OLLAMA_URL, model: OLLAMA_MODEL, model_available, all_models: models });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 503 });
  }
}
