import { db } from "@/lib/db";
import { getShare } from "@/lib/public-shares";
import { readUpload } from "@/lib/uploads";

// The one file a public link shares (or the flyer of the service opportunity it shares). Nothing else.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const share = getShare((await params).token);
  const name =
    share?.kind === "file"
      ? share.file
      : share?.kind === "signup"
        ? (db().prepare("SELECT flyer_file FROM signups WHERE id = ?").get(share.signup_id) as { flyer_file: string | null } | undefined)?.flyer_file
        : null;
  const file = name ? readUpload(name) : null;
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "content-type": file.type,
      "x-content-type-options": "nosniff",
      "content-disposition": `inline; filename="${(share!.title || "flyer").replace(/[^\w.\- ]/g, "")}.${name!.split(".").pop()}"`,
      "cache-control": "public, max-age=300",
    },
  });
}
