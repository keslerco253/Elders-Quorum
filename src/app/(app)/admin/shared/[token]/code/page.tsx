import { notFound } from "next/navigation";
import { requirePresidency } from "@/lib/auth";
import { getShare, shareUrl } from "@/lib/public-shares";
import { PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { ShareButton } from "@/components/share-button";

export const metadata = { title: "QR code" };

/** One QR code, big and centered, to save, print or show on a screen. */
export default async function QrCodePage({ params }: { params: Promise<{ token: string }> }) {
  const user = await requirePresidency();
  const share = getShare((await params).token);
  if (!share || share.org_id !== user.org_id) notFound();
  const url = shareUrl(share.token);
  const png = `/admin/shared/${share.token}/qr`;
  return (
    <>
      <PageHeader title={share.title || "QR code"} back={{ href: "/admin/shared", label: "Shared publicly" }} />
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${png}?view=1`} alt={`QR code for ${share.title || "this link"}`} className="aspect-square w-full max-w-sm rounded-2xl border border-border bg-white p-4 shadow-sm" />
        <p className="app-only text-sm text-muted">Press and hold the code to save it to your Photos or share it.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <a href={png} download className="web-only btn-primary">
            Download QR code
          </a>
          <ShareButton url={url} title={share.title || undefined} label="Share link…" className="btn-secondary" />
          <CopyButton text={url} label="Copy link" />
        </div>
        <p className="max-w-sm break-all font-mono text-xs text-muted">{url}</p>
      </div>
    </>
  );
}
