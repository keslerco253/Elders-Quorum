import { heldJournalFile } from "@/lib/journal-handoff";

// A journal handed from the phone app to the phone's browser view (see journal-handoff.ts).
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const f = heldJournalFile((await params).token);
  const headers: Record<string, string> = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" };
  if (!f) return new Response("This link has expired. Go back to the app and tap the button again.", { status: 404, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
  if (f.filename) headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`;
  return new Response(typeof f.body === "string" ? f.body : new Uint8Array(f.body), { headers: { ...headers, "Content-Type": f.type } });
}
