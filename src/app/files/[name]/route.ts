import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/uploads";

// Plan PDFs are only served to signed-in members of the plan's ward.
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await getUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const { name } = await params;
  const plan = db()
    .prepare(
      `SELECT v.pdf_name FROM plan_versions v JOIN ward_plans p ON p.id = v.plan_id
       WHERE v.pdf_file = ? AND p.ward_id IN (SELECT ward_id FROM ward_members WHERE member_id = ?)`,
    )
    .get(name, user.id) as { pdf_name: string } | undefined;
  const data = plan && readUpload(name);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${plan.pdf_name.replace(/[^\w.\- ]/g, "")}"`,
      "cache-control": "private, max-age=3600",
    },
  });
}
