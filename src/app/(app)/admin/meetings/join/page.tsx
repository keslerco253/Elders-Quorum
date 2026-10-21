import { redirect } from "next/navigation";
import { requirePresidency } from "@/lib/auth";
import { videoLink } from "@/lib/meetings";

/** "Join" in a meeting-started notification: opens the presidency's video meeting. */
export default async function JoinVideoPage() {
  const user = await requirePresidency();
  redirect(videoLink(user.org_id) ?? "/admin/meetings?msg=No%20video%20meeting%20link%20is%20set%20up.");
}
