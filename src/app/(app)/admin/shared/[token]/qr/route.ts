import { requirePresidency } from "@/lib/auth";
import { getShare, sharePng } from "@/lib/public-shares";

// The QR code as a picture to save (for posters, bulletins and slides).
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const user = await requirePresidency();
  const share = getShare((await params).token);
  if (!share || share.org_id !== user.org_id) return new Response("Not found", { status: 404 });
  const png = await sharePng(share.token);
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "content-disposition": `attachment; filename="QR code - ${(share.title || "shared").replace(/[^\w.\- ]/g, "")}.png"`,
      "cache-control": "no-store",
    },
  });
}
