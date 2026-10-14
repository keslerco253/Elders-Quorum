import { getUser } from "@/lib/auth";
import { isExpoToken, removeAppToken, saveAppToken } from "@/lib/push";

// The phone app hands over its notification token (through the web page it
// shows) once the member allows notifications, and on each launch after that.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!isExpoToken(body?.token)) return Response.json({ error: "bad token" }, { status: 400 });
  saveAppToken(user.id, body.token, String(body.platform || ""));
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (isExpoToken(body?.token)) removeAppToken(body.token, user.id);
  return Response.json({ ok: true });
}
