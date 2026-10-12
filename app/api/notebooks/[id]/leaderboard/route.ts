import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const db = getDb();
  const { canAccess } = userCanAccess(notebookId, user.id);
  if (!canAccess) return err("Not found", 404);

  // All members: owner + shared users
  const members = db.prepare(
    `SELECT u.id, u.display_name FROM users u WHERE u.id = (SELECT owner_id FROM notebooks WHERE id = ?)
     UNION
     SELECT u.id, u.display_name FROM users u JOIN shares s ON s.shared_with_user_id = u.id WHERE s.notebook_id = ?`
  ).all(notebookId, notebookId) as any[];

  const rows = members.map((m: any) => {
    const studyTime = (db.prepare(
      "SELECT COALESCE(SUM(duration_seconds), 0) AS t FROM study_sessions WHERE user_id = ? AND notebook_id = ?"
    ).get(m.id, notebookId) as any)?.t ?? 0;

    const reviewCount = (db.prepare(
      `SELECT COALESCE(SUM(total), 0) AS c FROM quiz_attempts WHERE user_id = ? AND notebook_id = ?`
    ).get(m.id, notebookId) as any)?.c ?? 0;

    const quizAvg = (db.prepare(
      "SELECT AVG(CAST(score AS REAL)/total*100) AS avg FROM quiz_attempts WHERE user_id = ? AND notebook_id = ?"
    ).get(m.id, notebookId) as any)?.avg ?? null;

    return {
      user_id: m.id,
      display_name: m.display_name,
      study_seconds: studyTime,
      cards_reviewed: reviewCount,
      quiz_avg: quizAvg !== null ? Math.round(quizAvg) : null,
      points: Math.floor(studyTime / 60) + reviewCount * 2 + (quizAvg ? Math.round(quizAvg / 10) : 0),
    };
  });

  rows.sort((a: any, b: any) => b.points - a.points);
  return ok({ leaderboard: rows });
}
