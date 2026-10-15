import { appUrl } from "@/lib/config";
import { shortLinkTarget } from "@/lib/notification-log";
import { getUser } from "@/lib/auth";

// The short link in texts (mywardlink.net/n/123): opens that notification's page in its
// organization and marks it read. Only the person it was sent to is told where it goes
// (the numbers are in order, so anyone could try them); others go to the home page,
// which asks them to sign in.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  return Response.redirect(new URL(shortLinkTarget(Number((await params).id), user?.id ?? null), appUrl()), 302);
}
