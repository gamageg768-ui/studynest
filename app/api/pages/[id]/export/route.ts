import { NextRequest, NextResponse } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const pageId = Number(params.id);
  const db = getDb();
  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId) as any;
  if (!page) return err("Not found", 404);
  const { canAccess } = userCanAccess(page.notebook_id, user.id);
  if (!canAccess) return err("Not found", 404);

  const filename = (page.title || "page").replace(/[^a-z0-9]/gi, "_") + ".md";
  return new NextResponse(page.content || "", {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
