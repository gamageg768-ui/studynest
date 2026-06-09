import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

function getChartOrErr(chartId: number, userId: number) {
  const db = getDb();
  const c = db.prepare("SELECT * FROM flowcharts WHERE id = ?").get(chartId) as any;
  if (!c) return { c: null, permission: "", notFound: true };
  const { canAccess, permission } = userCanAccess(c.notebook_id, userId);
  if (!canAccess) return { c: null, permission: "", notFound: true };
  return { c, permission, notFound: false };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const { c, notFound } = getChartOrErr(Number(params.id), user.id);
  if (notFound || !c) return err("Not found", 404);
  return ok(c);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const { c, permission, notFound } = getChartOrErr(Number(params.id), user.id);
  if (notFound || !c) return err("Not found", 404);
  if (permission === "read") return err("Permission denied", 403);

  const data = await req.json().catch(() => ({}));
  const title = ((data.title as string) || c.title).trim();
  const source = (data.source as string) ?? c.source;
  getDb()
    .prepare(
      "UPDATE flowcharts SET title = ?, source = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .run(title, source, c.id);
  return ok({ ...c, title, source });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const { c, permission, notFound } = getChartOrErr(Number(params.id), user.id);
  if (notFound || !c) return err("Not found", 404);
  if (permission === "read") return err("Permission denied", 403);
  getDb().prepare("DELETE FROM flowcharts WHERE id = ?").run(c.id);
  return ok({ ok: true });
}
