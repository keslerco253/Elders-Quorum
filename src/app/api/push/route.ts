import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { savePushSubscription, vapidPublicKey } from "@/lib/push";

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ publicKey: vapidPublicKey() });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const sub = body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return Response.json({ error: "bad subscription" }, { status: 400 });
  savePushSubscription(user.id, sub);
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (body?.endpoint) db().prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND member_id = ?").run(body.endpoint, user.id);
  return Response.json({ ok: true });
}
