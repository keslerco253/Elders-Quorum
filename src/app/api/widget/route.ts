import { widgetData, widgetUser } from "@/lib/widget";

// What the home-screen widget shows. It signs in with the key the app gave it.
export async function GET(req: Request) {
  const key = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = widgetUser(key);
  if (!user) return Response.json({ error: "signed out" }, { status: 401, headers: { "cache-control": "no-store" } });
  if (!user.welcomed_at || user.ward.pending) return Response.json({ error: "not ready" }, { status: 403, headers: { "cache-control": "no-store" } });
  return Response.json(widgetData(user), { headers: { "cache-control": "no-store" } });
}
