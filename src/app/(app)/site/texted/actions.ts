"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { remindersFromForm } from "@/lib/personal-todos";
import { saveTextedReminders, TEXTED_KINDS, textedReminders, type TextedKind } from "@/lib/photo-event";
import type { CurrentUser } from "@/lib/types";
import { memberCanText } from "../../more/reminders/can-text";

async function ownerAndKind(fd: FormData): Promise<{ id: number; kind: TextedKind; title: string; user: CurrentUser }> {
  const user = await requireUser();
  if (!user.is_site_owner) redirect("/");
  const k = TEXTED_KINDS.find((t) => t.kind === fd.get("kind"));
  if (!k) redirect("/site/texted");
  return { id: user.id, kind: k.kind, title: k.title.replace(/ \(.*\)$/, ""), user };
}

const back = (msg: string): never => {
  revalidatePath("/site/texted");
  redirect(`/site/texted?msg=${encodeURIComponent(msg)}`);
};

export async function saveTextedRemindersAction(fd: FormData) {
  const { id, kind, title, user } = await ownerAndKind(fd);
  if (fd.get("reset") === "1") {
    saveTextedReminders(id, kind, null);
    back(`${title}: back to the starting reminders.`);
  }
  let list = remindersFromForm(fd);
  // Texting can't be ticked right now (not set up, or texts turned off): keep the Text
  // the saved ones had, so saving doesn't quietly drop them.
  if (!memberCanText(user)) {
    const before = textedReminders(id, kind);
    list = list.map((r) => ({ ...r, text: r.text || !!before.find((b) => b.when === r.when)?.text }));
  }
  saveTextedReminders(id, kind, list);
  back(`Saved: reminders for texted ${title.toLowerCase()}.`);
}
