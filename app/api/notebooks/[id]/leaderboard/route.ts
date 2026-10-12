import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess } = await userCanAccess(notebookId, user.id);
  if (!canAccess) return err("Not found", 404);

  // All members: owner + shared users
  const members = await sql`
    SELECT u.id, u.display_name FROM users u WHERE u.id = (SELECT owner_id FROM notebooks WHERE id = ${notebookId})
    UNION
    SELECT u.id, u.display_name FROM users u JOIN shares s ON s.shared_with_user_id = u.id WHERE s.notebook_id = ${notebookId}
  `;

  const rows = await Promise.all(members.map(async (m: any) => {
    const [studyRow] = await sql`
      SELECT COALESCE(SUM(duration_seconds), 0) AS t FROM study_sessions WHERE user_id = ${m.id} AND notebook_id = ${notebookId}
    `;
    const studyTime = studyRow?.t ?? 0;

    const [reviewRow] = await sql`
      SELECT COALESCE(SUM(total), 0) AS c FROM quiz_attempts WHERE user_id = ${m.id} AND notebook_id = ${notebookId}
    `;
    const reviewCount = reviewRow?.c ?? 0;

    const [quizRow] = await sql`
      SELECT AVG(CAST(score AS REAL)/total*100) AS avg FROM quiz_attempts WHERE user_id = ${m.id} AND notebook_id = ${notebookId}
    `;
    const quizAvg = quizRow?.avg ?? null;

    return {
      user_id: m.id,
      display_name: m.display_name,
      study_seconds: studyTime,
      cards_reviewed: reviewCount,
      quiz_avg: quizAvg !== null ? Math.round(quizAvg) : null,
      points: Math.floor(studyTime / 60) + reviewCount * 2 + (quizAvg ? Math.round(quizAvg / 10) : 0),
    };
  }));

  rows.sort((a: any, b: any) => b.points - a.points);
  return ok({ leaderboard: rows });
}
