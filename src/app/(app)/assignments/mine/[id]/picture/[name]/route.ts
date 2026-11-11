import { getUser } from "@/lib/auth";
import { getPersonalTodo, todoImages } from "@/lib/personal-todos";
import { readUpload } from "@/lib/uploads";

// A picture kept with one of the member's own to-dos: only they can open it.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  const user = await getUser();
  const { id, name } = await params;
  const todo = user ? getPersonalTodo(user.id, Number(id)) : undefined;
  const file = todo && todoImages(todo).includes(name) ? readUpload(name) : null;
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), { headers: { "Content-Type": file.type, "Cache-Control": "private, max-age=3600" } });
}
