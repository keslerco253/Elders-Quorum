import { DateTime } from "luxon";
import { getUser } from "@/lib/auth";
import { makeBackup } from "@/lib/backup-file";

// The site owner downloads everything the app keeps, e.g. to move it to another server.
export async function GET() {
  const user = await getUser();
  if (!user?.is_site_owner) return new Response("Only the site owner can download a backup.", { status: 403 });
  const file = await makeBackup();
  return new Response(new Uint8Array(file), {
    headers: {
      "content-type": "application/x-tar",
      "content-disposition": `attachment; filename="eq-app-backup-${DateTime.local().toFormat("yyyy-LL-dd-HHmm")}.tar"`,
      "cache-control": "no-store",
    },
  });
}
