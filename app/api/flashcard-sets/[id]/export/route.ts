import { NextRequest, NextResponse } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, isResponse } from "@/lib/api-utils";

function csvEscape(s: string) {
  return `"${(s || "").replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const setId = Number(params.id);
  const db = getDb();
  const set = db.prepare("SELECT * FROM flashcard_sets WHERE id = ?").get(setId) as any;
  if (!set) return err("Not found", 404);
  const { canAccess } = userCanAccess(set.notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);

  const cards = db
    .prepare("SELECT front, back FROM flashcards WHERE set_id = ? ORDER BY position ASC")
    .all(setId) as any[];

  const rows = ["front,back", ...cards.map(c => `${csvEscape(c.front)},${csvEscape(c.back)}`)];
  const csv = rows.join("\n");
  const filename = (set.title || "flashcards").replace(/[^a-z0-9]/gi, "_") + ".csv";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
