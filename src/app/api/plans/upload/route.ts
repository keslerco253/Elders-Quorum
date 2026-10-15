import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canCreatePlans } from "@/lib/plans";
import { saveUpload } from "@/lib/uploads";

// The plan editor uploads each picture or PDF as soon as it's added.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user || !canCreatePlans(user)) return Response.json({ error: "Only leaders can add files to plans." }, { status: 403 });
  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Choose a file." }, { status: 400 });
  if (file.size > 15_000_000) return Response.json({ error: `${file.name} is over 15 MB.` }, { status: 413 });
  let name: string;
  try {
    name = await saveUpload(file);
  } catch {
    return Response.json({ error: `${file.name} can't be added. Use a PDF or a picture (PNG, JPEG, GIF, WebP or an iPhone photo).` }, { status: 415 });
  }
  const original = file.name.slice(0, 200) || "Attachment";
  db().prepare("INSERT INTO plan_files (name, ward_id, original_name, uploaded_by) VALUES (?, ?, ?, ?)").run(name, user.ward_id, original, user.id);
  return Response.json({ file: name, name: original });
}
