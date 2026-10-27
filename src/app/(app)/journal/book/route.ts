import { getUser } from "@/lib/auth";
import { journalBookHtml, journalDocx, journalEntries, journalFileName, journalRange } from "@/lib/journal";

// The member's own journal to print (?print=1 opens the print screen), or as a Word
// document (?format=docx). Only ever their own.
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Sign in to see your journal.", { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const tz = user.ward.timezone;
  const { from, to } = journalRange(sp, tz);
  const book = { name: user.display_name, entries: journalEntries(user.id, { from, to }), tz, from, to };
  const headers = { "Cache-Control": "private, no-store" };
  if (sp.format === "docx") {
    return new Response(new Uint8Array(journalDocx(book)), {
      headers: {
        ...headers,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(journalFileName(user.display_name, "docx"))}`,
      },
    });
  }
  return new Response(journalBookHtml({ ...book, toolbar: sp.print === "1" }), { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}
