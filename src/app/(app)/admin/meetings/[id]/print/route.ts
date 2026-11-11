import { requirePresidency } from "@/lib/auth";
import { agendaPrintHtml } from "@/lib/agenda-print";

// A meeting's agenda to print (?print=1 opens the print screen) or read (?view=1). Presidency only.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePresidency();
  const sp = new URL(req.url).searchParams;
  const id = Number((await params).id);
  // ?view=1: to read on screen (Review agenda), with Back and Print.
  const toolbar = sp.get("view") === "1" ? "review" : sp.get("print") === "1" ? "browser" : undefined;
  const back = sp.get("back") === "meeting" ? `/admin/meetings/${id}` : "/admin/meetings";
  const page = agendaPrintHtml(user.org_id, id, { toolbar, back });
  if (!page) return new Response("That meeting no longer exists.", { status: 404 });
  return new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
