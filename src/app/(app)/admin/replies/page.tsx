import { redirect } from "next/navigation";
import { requirePresidency } from "@/lib/auth";

// Conversations with members now live in Messages → Inbox (every organization you lead).
export default async function RepliesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requirePresidency();
  const sp = await searchParams;
  redirect(sp.to ? `/admin/replies/${Number(sp.to)}#end` : "/messages");
}
