import { DateTime } from "luxon";
import { requirePresidency } from "@/lib/auth";
import { pastNotesHtml } from "@/lib/agenda-print";

// Finished meetings' notes to print for review (?months=3|6|12, or all; ?print=1 opens the print screen). Presidency only.
export async function GET(req: Request) {
  const user = await requirePresidency();
  const sp = new URL(req.url).searchParams;
  const page = pastNotesHtml(user.org_id, sp.get("months"), DateTime.now().setZone(user.ward.timezone).toISODate()!, { toolbar: sp.get("print") === "1" ? "browser" : undefined });
  return new Response(page ?? "Not found", { status: page ? 200 : 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
