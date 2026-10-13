import { answerRequest, getRequest, validAskToken } from "@/lib/teaching-requests";

// One-tap "Yes, I'll teach" from a push notification's button (the service
// worker posts here). Uses the request's private token, not a session.
export async function POST(req: Request) {
  const { id, t } = (await req.json().catch(() => ({}))) as { id?: number; t?: string };
  const r = id ? getRequest(Number(id)) : undefined;
  if (!r || !validAskToken(r.id, r.member_id, String(t ?? ""))) return Response.json({ ok: false }, { status: 403 });
  const result = await answerRequest(r.id, r.member_id, true);
  return Response.json({ ok: result === "accepted", result }, { status: result === "accepted" ? 200 : 409 });
}
