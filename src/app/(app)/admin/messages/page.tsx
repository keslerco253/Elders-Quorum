import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Send a message" };

// Sending now lives in Messages → New message; old links land there.
export default async function SendMessageRedirect({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const to = /^(everyone|presidency|teachers|group:\d+)$/.test(sp.to ?? "") ? `?to=${encodeURIComponent(`aud:${user.org_id}:${sp.to}`)}` : "";
  redirect(`/messages/new${to}`);
}
