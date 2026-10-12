import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { sql, userCanAccess } from "@/lib/db";
import { auth, err, isResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req);
  if (isResponse(user)) return user;
  const notebookId = Number(params.id);
  const [nb] = await sql`SELECT title FROM notebooks WHERE id = ${notebookId}`;
  if (!nb) return err("Not found", 404);
  const { canAccess } = await userCanAccess(notebookId, user.id);
  if (!canAccess) return err("Not found", 404);

  const pages = await sql`SELECT title, content FROM pages WHERE notebook_id = ${notebookId} ORDER BY created_at ASC`;

  const zip = new JSZip();
  pages.forEach((page: any, i: number) => {
    const safe = (page.title || `page_${i + 1}`).replace(/[^a-z0-9]/gi, "_");
    zip.file(`${safe}.md`, page.content || "");
  });

  const buffer = await zip.generateAsync({ type: "uint8array" });
  const nbSafe = (nb.title || "notebook").replace(/[^a-z0-9]/gi, "_");
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nbSafe}.zip"`,
    },
  });
}
