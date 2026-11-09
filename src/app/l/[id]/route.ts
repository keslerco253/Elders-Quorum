import { appUrl } from "@/lib/config";
import { db } from "@/lib/db";

// The short link in lesson texts (mywardlink.net/l/57): straight to the talk in the
// Church's library (Gospel Library opens it if it's installed), so the text can be one
// segment. Talk links are public, so no sign-in is needed. Without a link, the lesson page.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const lesson = Number.isInteger(id) ? (db().prepare("SELECT url FROM lessons WHERE id = ?").get(id) as { url: string } | undefined) : undefined;
  const to = lesson && /^https:\/\/[^\s]+$/i.test(lesson.url) ? lesson.url : new URL(`/lessons/${id}`, appUrl()).toString();
  return Response.redirect(to, 302);
}
