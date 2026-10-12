import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const GROQ_MODEL = process.env.GROQ_MODEL || "llama3-70b-8192";

export async function GET() {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ ok: false, error: "GROQ_API_KEY not set" }, { status: 503 });
  }
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const models = await groq.models.list();
    const modelIds = models.data.map((m) => m.id);
    const model_available = modelIds.includes(GROQ_MODEL);
    return NextResponse.json({ ok: true, provider: "groq", model: GROQ_MODEL, model_available, all_models: modelIds });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 503 });
  }
}
