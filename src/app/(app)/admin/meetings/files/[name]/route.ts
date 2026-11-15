import { getUser } from "@/lib/auth";
import { appUrl } from "@/lib/config";
import { ledOrgIds } from "@/lib/conversations";
import { db } from "@/lib/db";
import { opensInBrowser } from "@/lib/upload-names";
import { readUpload } from "@/lib/uploads";

// A file attached to an agenda item: only the presidency (or bishopric) of its organization
// can open it. PDFs and pictures open in the browser; other files download.
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await getUser();
  const { name } = await params;
  if (!user) return Response.redirect(new URL(`/login?next=${encodeURIComponent(`/admin/meetings/files/${name}`)}`, appUrl()), 302);
  const f = db().prepare("SELECT org_id, original_name FROM agenda_files WHERE name = ?").get(name) as { org_id: number; original_name: string } | undefined;
  // In support view, the ward being looked into.
  const file = f && (ledOrgIds(user.id).includes(f.org_id) || (user.support && user.orgs.some((o) => o.id === f.org_id))) ? readUpload(name) : null;
  if (!f || !file) return new Response("Not found", { status: 404 });
  const label = f.original_name.replace(/[^\w.\- ()]/g, "") || "file";
  const headers: Record<string, string> = {
    "content-type": file.type,
    "x-content-type-options": "nosniff",
    "content-disposition": `${opensInBrowser(name) ? "inline" : "attachment"}; filename="${label}"; filename*=UTF-8''${encodeURIComponent(f.original_name)}`,
    "cache-control": "private, no-store",
    "accept-ranges": "bytes",
  };
  // Sound and video are played a piece at a time (iPhones won't play them otherwise).
  const size = file.data.length;
  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${size}` } });
    return new Response(new Uint8Array(file.data.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(file.data), { headers: { ...headers, "content-length": String(size) } });
}
