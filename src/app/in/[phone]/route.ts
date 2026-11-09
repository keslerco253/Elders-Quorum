import { appUrl } from "@/lib/config";

// The short sign-in link in texts (mywardlink.net/in/2085550100): the sign-in page
// with that number filled in, so the text stays short.
export async function GET(_req: Request, { params }: { params: Promise<{ phone: string }> }) {
  const digits = (await params).phone.replace(/\D/g, "").slice(0, 15);
  return Response.redirect(new URL(digits ? `/login?contact=${digits}` : "/login", appUrl()).toString(), 302);
}
