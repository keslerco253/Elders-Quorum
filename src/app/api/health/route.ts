import { db } from "@/lib/db";

// Used by the Windows installer to confirm it's talking to this app, and to see
// which version is running (when it was built).
export function GET() {
  db().prepare("SELECT 1").get();
  return Response.json({ app: "elders-quorum", ok: true, built: process.env.BUILT_AT ?? null });
}
