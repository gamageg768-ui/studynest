import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { auth, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const uid = user.id;

  const [totalRow] = await sql`
    SELECT COALESCE(SUM(duration_seconds), 0) AS total FROM study_sessions WHERE user_id = ${uid}
  `;

  const [todayRow] = await sql`
    SELECT COALESCE(SUM(duration_seconds), 0) AS today FROM study_sessions
    WHERE user_id = ${uid} AND TO_CHAR(created_at, 'YYYY-MM-DD') = TO_CHAR(NOW(), 'YYYY-MM-DD')
  `;

  const [cardsDueRow] = await sql`
    SELECT COUNT(*) AS cards_due FROM flashcards fc
    JOIN flashcard_sets fs ON fs.id = fc.set_id
    JOIN notebooks n ON n.id = fs.notebook_id
    WHERE (n.owner_id = ${uid} OR EXISTS (
      SELECT 1 FROM shares s WHERE s.notebook_id = n.id AND s.shared_with_user_id = ${uid}
    ))
    AND fc.next_review IS NOT NULL
    AND fc.next_review <= NOW()
  `;

  const [avgRow] = await sql`
    SELECT ROUND(AVG(CAST(score AS REAL) / total * 100)::numeric, 1) AS avg_score
    FROM quiz_attempts WHERE user_id = ${uid} AND created_at > NOW() - INTERVAL '30 days' AND total > 0
  `;

  const dates = await sql`
    SELECT DISTINCT TO_CHAR(created_at, 'YYYY-MM-DD') AS study_date
    FROM study_sessions WHERE user_id = ${uid}
    ORDER BY study_date DESC LIMIT 60
  `;

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
    total_study_seconds: totalRow?.total ?? 0,
    today_study_seconds: todayRow?.today ?? 0,
    cards_due: cardsDueRow?.cards_due ?? 0,
    quiz_avg_score: avgRow?.avg_score ?? null,
    streak_days,
  });
}
