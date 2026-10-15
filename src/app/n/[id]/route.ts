import { db } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { withSeen } from "@/lib/notify";
import { withOrg } from "@/lib/org-cookie";

// The short link in texts (mywardlink.net/n/123): opens that notification's page in its
// organization and marks it read. It only redirects; the page itself checks who's signed in.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const row = Number.isInteger(id) ? (db().prepare("SELECT url, org_id FROM notification_log WHERE id = ?").get(id) as { url: string; org_id: number | null } | undefined) : undefined;
  const path = row && row.url.startsWith("/") ? withOrg(withSeen(row.url, id), row.org_id) : "/";
  return Response.redirect(new URL(path, appUrl()), 302);
}
