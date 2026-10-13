import { getUser } from "@/lib/auth";
import { markNotificationsRead } from "@/lib/notification-log";

// Opening a notification's link (?n=<id>) marks it read.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: number };
  if (id) markNotificationsRead(user.id, Number(id));
  return Response.json({ ok: true });
}
