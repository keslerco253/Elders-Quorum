import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/uploads";

// Plan attachments (PDFs and pictures) are only served to signed-in members of the plan's ward.
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await getUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const { name } = await params;
  const wards = "SELECT ward_id FROM ward_members WHERE member_id = ?";
  const found =
    (db().prepare(`SELECT original_name AS label FROM plan_files WHERE name = ? AND ward_id IN (${wards})`).get(name, user.id) as { label: string } | undefined) ??
    (db()
      .prepare(`SELECT v.pdf_name AS label FROM plan_versions v JOIN ward_plans p ON p.id = v.plan_id WHERE v.pdf_file = ? AND p.ward_id IN (${wards})`)
      .get(name, user.id) as { label: string } | undefined);
  const file = found && readUpload(name);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "content-type": file.type,
      "x-content-type-options": "nosniff",
      "content-disposition": `inline; filename="${(found.label || "file").replace(/[^\w.\- ]/g, "")}"`,
      "cache-control": "private, max-age=3600",
    },
  });
}
