import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { joinQrSvg } from "@/lib/invite";

export const metadata = { title: "Join the app" };

// Full-screen page for a TV or projector in quorum meeting (no menus).
export default async function PresentInvitePage() {
  const user = await requireAdmin();
  const code = user.ward.join_code;
  if (!code) redirect("/admin/invite");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-white p-6 text-center text-[#1d3a5f]">
      <h1 className="text-3xl font-bold sm:text-5xl">Join the {user.ward.name} app</h1>
      <p className="text-lg sm:text-2xl">Point your phone camera at the code, then tap the link.</p>
      <div className="w-[min(70vh,80vw)]" dangerouslySetInnerHTML={{ __html: await joinQrSvg(code) }} />
      <p className="text-xl sm:text-3xl">
        Join code: <span className="font-mono font-bold tracking-[0.2em]">{code}</span>
      </p>
    </div>
  );
}
