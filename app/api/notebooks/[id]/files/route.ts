import { NextRequest } from "next/server";
import { getDb, userCanAccess } from "@/lib/db";
import { auth, err, ok, isResponse } from "@/lib/api-utils";
import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

function secureFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").replace(/^\./, "_");
}

function mimeFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf",
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
  };
  return map[ext] || "application/octet-stream";
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess } = userCanAccess(notebookId, user.id);
  if (!canAccess) return err("Not found", 404);
  const files = getDb()
    .prepare(
      "SELECT id, notebook_id, original_name, mime_type, file_size, created_at FROM attachments WHERE notebook_id = ? ORDER BY created_at DESC"
    )
    .all(notebookId);
  return ok({ files });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const { canAccess, permission } = userCanAccess(notebookId, user.id);
  if (!canAccess || permission === "read") return err("Permission denied", 403);

  let formData: FormData;
  try { formData = await req.formData(); } catch { return err("Invalid form data", 400); }
  const file = formData.get("file") as File | null;
  if (!file || !file.name) return err("No file provided", 400);

  const originalName = secureFilename(file.name);
  const ext = path.extname(originalName).toLowerCase();
  const storedName = `${randomBytes(16).toString("hex")}${ext}`;
  const destPath = path.join(UPLOAD_DIR, storedName);

  await mkdir(UPLOAD_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(destPath, buffer);

  const mimeType = file.type || mimeFromName(originalName);
  const fileSize = buffer.length;
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO attachments (notebook_id, uploader_id, original_name, stored_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(notebookId, user.id, originalName, storedName, mimeType, fileSize);

  const row = db
    .prepare("SELECT created_at FROM attachments WHERE id = ?")
    .get(result.lastInsertRowid) as any;
  return ok(
    {
      id: result.lastInsertRowid,
      notebook_id: notebookId,
      original_name: originalName,
      mime_type: mimeType,
      file_size: fileSize,
      created_at: row?.created_at || "",
    },
    201
  );
}
