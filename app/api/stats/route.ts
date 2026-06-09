import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { auth, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const db = getDb();
  const uid = user.id;

  const { total } = db
    .prepare("SELECT COALESCE(SUM(duration_seconds), 0) AS total FROM study_sessions WHERE user_id = ?")
    .get(uid) as any;

  const { today } = db
    .prepare("SELECT COALESCE(SUM(duration_seconds), 0) AS today FROM study_sessions WHERE user_id = ? AND date(created_at) = date('now')")
    .get(uid) as any;

  const { cards_due } = db
    .prepare(
      `SELECT COUNT(*) AS cards_due FROM flashcards fc
       JOIN flashcard_sets fs ON fs.id = fc.set_id
       JOIN notebooks n ON n.id = fs.notebook_id
       WHERE (n.owner_id = ? OR EXISTS (
         SELECT 1 FROM shares s WHERE s.notebook_id = n.id AND s.shared_with_user_id = ?
       ))
       AND fc.next_review IS NOT NULL
       AND fc.next_review <= datetime('now')`
    )
    .get(uid, uid) as any;

  const avgRow = db
    .prepare(
      `SELECT ROUND(AVG(CAST(score AS REAL) / total * 100), 1) AS avg_score
       FROM quiz_attempts WHERE user_id = ? AND created_at > datetime('now', '-30 days') AND total > 0`
    )
    .get(uid) as any;

  const dates = db
    .prepare(
      "SELECT DISTINCT date(created_at) AS study_date FROM study_sessions WHERE user_id = ? ORDER BY study_date DESC LIMIT 60"
    )
    .all(uid) as any[];

  let streak_days = 0;
  const today_d = new Date();
  today_d.setHours(0, 0, 0, 0);
  for (const row of dates) {
    const dt = new Date(row.study_date + "T00:00:00");
    if (dt.getTime() === today_d.getTime()) {
      streak_days++;
      today_d.setDate(today_d.getDate() - 1);
    } else {
      break;
    }
  }

  return ok({
    total_study_seconds: total,
    today_study_seconds: today,
    cards_due,
    quiz_avg_score: avgRow?.avg_score ?? null,
    streak_days,
  });
}
