import { appUrl } from "@/lib/config";
import { shortLinkTarget } from "@/lib/notification-log";
import { getUser } from "@/lib/auth";

// The short link in texts (mywardlink.net/n/123): opens that notification's page in its
// organization and marks it read. Only the person it was sent to is told where it goes
// (the numbers are in order, so anyone could try them); others go to the home page.
// Someone not signed in (a phone's browser instead of the app) signs in first and then
// comes back here, or opens it in the app from the sign-in page.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const id = Number((await params).id);
  if (!user && Number.isInteger(id)) return Response.redirect(new URL(`/login?next=${encodeURIComponent(`/n/${id}`)}`, appUrl()), 302);
  return Response.redirect(new URL(shortLinkTarget(id, user?.id ?? null), appUrl()), 302);
}
