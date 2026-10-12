import { NextRequest, NextResponse } from "next/server";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, isResponse } from "@/lib/api-utils";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const fileId = Number(params.id);
  const [row] = await sql`SELECT * FROM attachments WHERE id = ${fileId}`;
  if (!row) return err("Not found", 404);
  const { canAccess } = await userCanAccess(row.notebook_id, user.id);
  if (!canAccess) return err("Permission denied", 403);

  const filePath = path.join(UPLOAD_DIR, row.stored_name);
  if (!existsSync(filePath)) return err("File missing from disk", 404);

  const buffer = await readFile(filePath);
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": row.mime_type,
      "Content-Length": buffer.length.toString(),
      ...(download
        ? { "Content-Disposition": `attachment; filename="${row.original_name}"` }
        : {}),
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const fileId = Number(params.id);
  const [row] = await sql`SELECT * FROM attachments WHERE id = ${fileId}`;
  if (!row) return err("Not found", 404);
  const { canAccess, permission } = await userCanAccess(row.notebook_id, user.id);
  if (!canAccess || !["owner", "edit"].includes(permission)) return err("Permission denied", 403);

  const filePath = path.join(UPLOAD_DIR, row.stored_name);
  if (existsSync(filePath)) {
    const { unlink } = await import("fs/promises");
    await unlink(filePath);
  }
  await sql`DELETE FROM attachments WHERE id = ${fileId}`;
  return NextResponse.json({ ok: true });
}
