import { cookies } from "next/headers";
import { getUser } from "@/lib/auth";
import { widgetKeyFor } from "@/lib/widget";

// The phone app asks (through the page it shows) for a key its widget can use.
export async function POST() {
  const user = await getUser();
  const session = (await cookies()).get("eq_session")?.value;
  if (!user || !session) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ key: widgetKeyFor(session) }, { headers: { "cache-control": "no-store" } });
}
