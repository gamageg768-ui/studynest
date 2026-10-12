import { NextRequest } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";

async function getChartOrErr(chartId: number, userId: number) {
  const [c] = await sql`SELECT * FROM flowcharts WHERE id = ${chartId}`;
  if (!c) return { c: null, permission: "", notFound: true };
  const { canAccess, permission } = await userCanAccess(c.notebook_id, userId);
  if (!canAccess) return { c: null, permission: "", notFound: true };
  return { c, permission, notFound: false };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const { c, notFound } = await getChartOrErr(Number(params.id), user.id);
  if (notFound || !c) return err("Not found", 404);
  return ok(c);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const { c, permission, notFound } = await getChartOrErr(Number(params.id), user.id);
  if (notFound || !c) return err("Not found", 404);
  if (permission === "read") return err("Permission denied", 403);

  const data = await req.json().catch(() => ({}));
  const title = ((data.title as string) || c.title).trim();
  const source = (data.source as string) ?? c.source;
  await sql`
    UPDATE flowcharts SET title = ${title}, source = ${source}, updated_at = NOW()
    WHERE id = ${c.id}
  `;
  return ok({ ...c, title, source });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const { c, permission, notFound } = await getChartOrErr(Number(params.id), user.id);
  if (notFound || !c) return err("Not found", 404);
  if (permission === "read") return err("Permission denied", 403);
  await sql`DELETE FROM flowcharts WHERE id = ${c.id}`;
  return ok({ ok: true });
}
