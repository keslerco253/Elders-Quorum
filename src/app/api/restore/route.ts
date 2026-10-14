import { getUser } from "@/lib/auth";
import { restoreBackup } from "@/lib/backup-file";
import { setupCodeMatches } from "@/lib/setup-code";
import { needsSetup } from "@/lib/wards";

const back = (path: string, params: Record<string, string>) => new Response(null, { status: 303, headers: { location: `${path}?${new URLSearchParams(params)}` } });

/**
 * Replaces everything with a backup. The site owner can do this any time
 * (More → Site owner, typing RESTORE). On a brand-new server with no one in
 * it yet, the setup page can too, with the SETUP_CODE setting.
 */
export async function POST(req: Request) {
  const user = await getUser();
  const owner = !!user?.is_site_owner;
  const from = owner ? "/site" : "/setup";
  const form = await req.formData().catch(() => null);
  if (!form) return back(from, { error: "Choose the backup file to restore." });
  if (owner) {
    if (String(form.get("confirm") || "").trim().toUpperCase() !== "RESTORE") return back(from, { error: "Type RESTORE to confirm replacing everything." });
  } else {
    if (!needsSetup()) return back("/login", { error: "This server is already set up. The site owner can restore a backup under More → Site owner." });
    if (!process.env.SETUP_CODE) return back(from, { error: "Start a ward with the site owner's email, then restore from More → Site owner." });
    if (!setupCodeMatches(String(form.get("setup_code") || ""))) return back(from, { error: "The setup code is incorrect." });
  }
  const file = form.get("backup");
  if (!(file instanceof File) || file.size === 0) return back(from, { error: "Choose the backup file to restore." });
  const res = restoreBackup(Buffer.from(await file.arrayBuffer()));
  if (!res.ok) return back(from, { error: res.error });
  return back("/login", { ok: `Backup restored: ${res.wards} ${res.wards === 1 ? "ward" : "wards"}, ${res.members} members${res.files ? ` and ${res.files} files` : ""}. Sign in as usual.` });
}
