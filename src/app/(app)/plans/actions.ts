"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { currentPlan, isPlanKind, PLAN_INFO } from "@/lib/plans";
import { savePdf } from "@/lib/uploads";
import { audienceMembers, notify } from "@/lib/notify";

export async function savePlan(fd: FormData) {
  const user = await requireAdmin();
  const kind = String(fd.get("kind"));
  if (!isPlanKind(kind)) redirect("/plans");
  const title = String(fd.get("title") || "").trim() || PLAN_INFO[kind].title;
  const body = String(fd.get("body") || "").slice(0, 100_000);
  const prev = currentPlan(user.org_id, kind);
  let pdfFile = fd.get("remove_pdf") === "on" ? null : (prev?.pdf_file ?? null);
  let pdfName = pdfFile ? (prev?.pdf_name ?? null) : null;
  const file = fd.get("pdf");
  if (file instanceof File && file.size > 0) {
    if (file.size > 10_000_000) redirect(`/plans/${kind}/edit?msg=${encodeURIComponent("PDF must be under 10 MB.")}`);
    try {
      pdfFile = await savePdf(file);
      pdfName = file.name;
    } catch {
      redirect(`/plans/${kind}/edit?msg=${encodeURIComponent("That file isn't a PDF.")}`);
    }
  }
  db().prepare("INSERT INTO plans (org_id, kind, title, body, pdf_file, pdf_name, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)").run(user.org_id, kind, title, body, pdfFile, pdfName, user.id);
  if (fd.get("announce") === "on") {
    await notify(audienceMembers(user.org_id, "everyone"), { title: `${title} updated`, body: "Take a look at the updated plan in the app.", url: `/plans/${kind}` });
  }
  revalidatePath("/plans", "layout");
  redirect(`/plans/${kind}?msg=${encodeURIComponent("Plan saved.")}`);
}
