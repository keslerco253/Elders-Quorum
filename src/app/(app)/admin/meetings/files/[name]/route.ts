import { getUser } from "@/lib/auth";
import { appUrl } from "@/lib/config";
import { ledOrgIds } from "@/lib/conversations";
import { db } from "@/lib/db";
import { opensInBrowser } from "@/lib/upload-names";
import { readUpload } from "@/lib/uploads";

// A file attached to an agenda item: only the presidency (or bishopric) of its organization
// can open it. PDFs and pictures open in the browser; other files download.
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await getUser();
  const { name } = await params;
  if (!user) return Response.redirect(new URL(`/login?next=${encodeURIComponent(`/admin/meetings/files/${name}`)}`, appUrl()), 302);
  const f = db().prepare("SELECT org_id, original_name FROM agenda_files WHERE name = ?").get(name) as { org_id: number; original_name: string } | undefined;
  // In support view, the ward being looked into.
  const file = f && (ledOrgIds(user.id).includes(f.org_id) || (user.support && user.orgs.some((o) => o.id === f.org_id))) ? readUpload(name) : null;
  if (!f || !file) return new Response("Not found", { status: 404 });
  const label = f.original_name.replace(/[^\w.\- ()]/g, "") || "file";
  return new Response(new Uint8Array(file.data), {
    headers: {
      "content-type": file.type,
      "x-content-type-options": "nosniff",
      "content-disposition": `${opensInBrowser(name) ? "inline" : "attachment"}; filename="${label}"; filename*=UTF-8''${encodeURIComponent(f.original_name)}`,
      "cache-control": "private, no-store",
    },
  });
}
