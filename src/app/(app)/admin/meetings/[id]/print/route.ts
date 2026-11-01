import { requirePresidency } from "@/lib/auth";
import { agendaPrintHtml } from "@/lib/agenda-print";

// A meeting's agenda to print (?print=1 opens the print screen). Presidency only.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePresidency();
  const page = agendaPrintHtml(user.org_id, Number((await params).id), { toolbar: new URL(req.url).searchParams.get("print") === "1" ? "browser" : undefined });
  if (!page) return new Response("That meeting no longer exists.", { status: 404 });
  return new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
