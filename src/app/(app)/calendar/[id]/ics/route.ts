import { getUser } from "@/lib/auth";
import { getEvent, icsFor } from "@/lib/events";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const e = getEvent(user, Number((await params).id));
  if (!e) return new Response("Not found", { status: 404 });
  return new Response(icsFor(e), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="event-${e.id}.ics"`,
    },
  });
}
