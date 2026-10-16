import { db } from "@/lib/db";
import { getShare } from "@/lib/public-shares";
import { readUpload } from "@/lib/uploads";
import { sharedPlanFiles } from "@/lib/public-shares";

// The one file a public link shares (or the flyer of the service opportunity it shares). Nothing else.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const share = getShare((await params).token);
  // A shared plan page: any picture or PDF on its current version, and nothing else.
  const wanted = new URL(req.url).searchParams.get("f") ?? "";
  const planFile = share?.kind === "plan" && share.plan_id ? (sharedPlanFiles(share.plan_id).includes(wanted) ? wanted : null) : null;
  const name = planFile ??
    (share?.kind === "file"
      ? share.file
      : share?.kind === "signup"
        ? (db().prepare("SELECT flyer_file FROM signups WHERE id = ?").get(share.signup_id) as { flyer_file: string | null } | undefined)?.flyer_file
        : null);
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
