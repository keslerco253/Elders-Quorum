import { restoreBackup } from "@/lib/backup-file";
import { needsSetup } from "@/lib/wards";

const back = (path: string, params: Record<string, string>) => new Response(null, { status: 303, headers: { location: `${path}?${new URLSearchParams(params)}` } });

// Restores a backup on a brand-new server (from the first-time setup page).
// Only while nobody has set the server up, and only with the setup code.
export async function POST(req: Request) {
  if (!needsSetup()) return back("/login", { error: "This server is already set up, so a backup can't be restored here." });
  const setupCode = process.env.SETUP_CODE;
  if (!setupCode) return back("/setup", { error: "Add a SETUP_CODE setting to this server first, then try again." });
  const form = await req.formData().catch(() => null);
  if (!form || String(form.get("setup_code") || "") !== setupCode) return back("/setup", { error: "The setup code is incorrect." });
  const file = form.get("backup");
  if (!(file instanceof File) || file.size === 0) return back("/setup", { error: "Choose the backup file to restore." });
  const res = restoreBackup(Buffer.from(await file.arrayBuffer()));
  if (!res.ok) return back("/setup", { error: res.error });
  return back("/login", { ok: `Backup restored: ${res.members} members${res.files ? ` and ${res.files} files` : ""}. Sign in as usual.` });
}
