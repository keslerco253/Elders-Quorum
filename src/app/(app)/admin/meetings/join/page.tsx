import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

/** The older "Join" link (in notifications already sent): the same as /join-meeting. */
export default async function JoinVideoPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const org = (await searchParams).org;
  redirect(`/join-meeting?org=${Number(org) || user.org_id}`);
}
