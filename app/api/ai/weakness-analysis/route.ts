import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";
import { callOllama } from "@/lib/ollama";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const data = await req.json().catch(() => ({}));
  const notebookId = Number(data.notebook_id);
  if (!notebookId) return err("notebook_id required", 400);

  const db = getDb();
  const { canAccess } = userCanAccess(notebookId, user.id);
  if (!canAccess) return err("Not found", 404);

  const weakCards = db.prepare(`
    SELECT f.front, f.back, f.ease_factor, f.repetitions
    FROM flashcards f
    JOIN flashcard_sets fs ON f.set_id = fs.id
    WHERE fs.notebook_id = ? AND f.ease_factor < 2.2
    ORDER BY f.ease_factor ASC LIMIT 20
  `).all(notebookId) as any[];

  const quizAttempts = db.prepare(`
    SELECT score, total FROM quiz_attempts
    WHERE user_id = ? AND notebook_id = ?
    ORDER BY created_at DESC LIMIT 5
  `).all(user.id, notebookId) as any[];

  const pageTitles = db.prepare(
    "SELECT title FROM pages WHERE notebook_id = ?"
  ).all(notebookId) as any[];

  if (weakCards.length === 0 && quizAttempts.length === 0) {
    return err("Not enough review data yet. Complete some flashcard reviews and quizzes first.", 400);
  }

  const cardLines = weakCards
    .map((c: any) => `- Q: ${c.front} | A: ${c.back} | ease: ${(c.ease_factor ?? 2.5).toFixed(2)} | reps: ${c.repetitions ?? 0}`)
    .join("\n") || "None yet";

  const quizLines = quizAttempts
    .map((a: any) => `${a.score}/${a.total} (${Math.round((a.score / a.total) * 100)}%)`)
    .join(", ") || "None yet";

  const prompt = `Student performance data for notebook covering: ${pageTitles.map((p: any) => p.title).join(", ")}

Difficult flashcards (ease factor < 2.2, lower = harder):
${cardLines}

Recent quiz scores: ${quizLines}

Identify the top 3 weak areas and provide 2 suggested practice flashcards for each.`;

  try {
    const raw = await callOllama(
      prompt,
      `You are a learning analytics expert. Analyze student performance and identify weak areas. Return ONLY valid JSON in this exact format, nothing else:
{"weak_areas":[{"concept":"string","explanation":"string","suggested_cards":[{"front":"string","back":"string"},{"front":"string","back":"string"}]}]}`
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
