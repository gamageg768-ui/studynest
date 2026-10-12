import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const db = getDb();
  const { canAccess, permission } = userCanAccess(notebookId, user.id);
  if (!canAccess) return err("Not found", 404);
  if (permission !== "owner" && permission !== "admin") return err("Owner/admin only", 403);

  const members = db.prepare(
    `SELECT u.id, u.display_name, u.username FROM users u WHERE u.id = (SELECT owner_id FROM notebooks WHERE id = ?)
     UNION
     SELECT u.id, u.display_name, u.username FROM users u JOIN shares s ON s.shared_with_user_id = u.id WHERE s.notebook_id = ?`
  ).all(notebookId, notebookId) as any[];

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 19);

  const rows = members.map((m: any) => {
    const weeklyStudy = (db.prepare(
      "SELECT COALESCE(SUM(duration_seconds), 0) AS t FROM study_sessions WHERE user_id = ? AND notebook_id = ? AND created_at >= ?"
    ).get(m.id, notebookId, weekAgo) as any)?.t ?? 0;

    const lastActive = (db.prepare(
      "SELECT MAX(created_at) AS ts FROM study_sessions WHERE user_id = ? AND notebook_id = ?"
    ).get(m.id, notebookId) as any)?.ts ?? null;

    const quizAttempts = (db.prepare(
      "SELECT COUNT(*) AS c FROM quiz_attempts WHERE user_id = ? AND notebook_id = ?"
    ).get(m.id, notebookId) as any)?.c ?? 0;

    const quizAvg = (db.prepare(
      "SELECT AVG(CAST(score AS REAL)/total*100) AS avg FROM quiz_attempts WHERE user_id = ? AND notebook_id = ?"
    ).get(m.id, notebookId) as any)?.avg ?? null;

    const pagesAuthored = (db.prepare(
      `SELECT COUNT(*) AS c FROM page_versions WHERE saved_by = ? AND page_id IN (SELECT id FROM pages WHERE notebook_id = ?)`
    ).get(m.id, notebookId) as any)?.c ?? 0;

    return {
      user_id: m.id,
      display_name: m.display_name,
      username: m.username,
      weekly_study_seconds: weeklyStudy,
      last_active: lastActive,
      quiz_attempts: quizAttempts,
      quiz_avg: quizAvg !== null ? Math.round(quizAvg) : null,
      pages_authored: pagesAuthored,
    };
  });

  return ok({ progress: rows });
}
