import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess, permission } = await userCanAccess(notebookId, user.id);
  if (!canAccess) return err("Not found", 404);
  if (permission !== "owner" && permission !== "admin") return err("Owner/admin only", 403);

  const members = await sql`
    SELECT u.id, u.display_name, u.username FROM users u WHERE u.id = (SELECT owner_id FROM notebooks WHERE id = ${notebookId})
    UNION
    SELECT u.id, u.display_name, u.username FROM users u JOIN shares s ON s.shared_with_user_id = u.id WHERE s.notebook_id = ${notebookId}
  `;

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const rows = await Promise.all(members.map(async (m: any) => {
    const [weeklyRow] = await sql`
      SELECT COALESCE(SUM(duration_seconds), 0) AS t FROM study_sessions WHERE user_id = ${m.id} AND notebook_id = ${notebookId} AND created_at >= ${weekAgo}
    `;
    const weeklyStudy = weeklyRow?.t ?? 0;

    const [lastActiveRow] = await sql`
      SELECT MAX(created_at) AS ts FROM study_sessions WHERE user_id = ${m.id} AND notebook_id = ${notebookId}
    `;
    const lastActive = lastActiveRow?.ts ?? null;

    const [quizAttemptsRow] = await sql`
      SELECT COUNT(*) AS c FROM quiz_attempts WHERE user_id = ${m.id} AND notebook_id = ${notebookId}
    `;
    const quizAttempts = quizAttemptsRow?.c ?? 0;

    const [quizAvgRow] = await sql`
      SELECT AVG(CAST(score AS REAL)/total*100) AS avg FROM quiz_attempts WHERE user_id = ${m.id} AND notebook_id = ${notebookId}
    `;
    const quizAvg = quizAvgRow?.avg ?? null;

    const [pagesAuthoredRow] = await sql`
      SELECT COUNT(*) AS c FROM page_versions WHERE saved_by = ${m.id} AND page_id IN (SELECT id FROM pages WHERE notebook_id = ${notebookId})
    `;
    const pagesAuthored = pagesAuthoredRow?.c ?? 0;

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
  }));

  return ok({ progress: rows });
}
