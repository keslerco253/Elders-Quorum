import { getUser } from "@/lib/auth";
import { eventImages, getPersonalEvent } from "@/lib/personal-events";
import { readUpload } from "@/lib/uploads";

// A picture kept with one of the member's own events: only they can open it.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  const user = await getUser();
  const { id, name } = await params;
  const event = user ? getPersonalEvent(user.id, Number(id)) : undefined;
  const file = event && eventImages(event).includes(name) ? readUpload(name) : null;
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), { headers: { "Content-Type": file.type, "Cache-Control": "private, max-age=3600" } });
}
