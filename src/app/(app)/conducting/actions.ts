"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePresidency, requireUser } from "@/lib/auth";
import { answerSwap, askToConduct, cancelSwap, CONDUCT_MODES, conductSettings, presidencyWithCallings, saveConductSettings, setConductor, type ConductMode } from "@/lib/conducting";
import { audienceMembers, notify, recipientById } from "@/lib/notify";
import { withOrg } from "@/lib/org-cookie";
import { formatDate, todayIn } from "@/lib/time";

function go(text: string): never {
  redirect(`/conducting?msg=${encodeURIComponent(text)}`);
}

/** Asks another presidency member to conduct a Sunday; they get a notification to answer. */
export async function askConduct(fd: FormData) {
  const user = await requirePresidency();
  const date = String(fd.get("date") || "");
  const toId = Number(fd.get("to_id"));
  const note = String(fd.get("note") || "");
  const res = askToConduct(user.org_id, date, user.id, toId, note, todayIn(user.ward.timezone));
  if ("error" in res) go(res.error);
  const to = recipientById(toId, user.org_id);
  if (to) {
    await notify([to], {
      title: `Can you conduct on ${formatDate(date, "short")}?`,
      body: `${user.display_name} asked if you can conduct ${user.orgLabel} on ${formatDate(date)}.${note.trim() ? ` "${note.trim().slice(0, 200)}"` : ""} Tap to answer.`,
      url: withOrg(`/conducting#ask-${res.id}`, user.org_id),
      linkLabel: "Answer",
    }, { followUp: { what: `Asked to conduct on ${formatDate(date, "short")}` } });
  }
  revalidatePath("/", "layout");
  go(`Asked ${to?.display_name ?? "them"}. You'll be notified when they answer.`);
}

/** Yes or no to conducting. Yes: the whole presidency hears who's conducting. */
export async function answerConduct(fd: FormData) {
  const user = await requireUser();
  const accept = fd.get("answer") === "yes";
  const s = answerSwap(Number(fd.get("swap_id")), user.id, accept);
  if (!s) go("That request was already answered or withdrawn.");
  const when = formatDate(s.date);
  if (accept) {
    const everyone = audienceMembers(s.org_id, "presidency").filter((r) => r.id !== user.id);
    await notify(everyone, {
      title: `${user.display_name} is conducting ${formatDate(s.date, "short")}`,
      body: `${user.display_name} will conduct on ${when}${s.from_name ? `, instead of ${s.from_name}` : ""}.`,
      url: withOrg("/conducting", s.org_id),
    });
  } else {
    const from = recipientById(s.from_id, s.org_id);
    if (from) await notify([from], { title: `${user.display_name} can't conduct ${formatDate(s.date, "short")}`, body: `You may want to ask someone else for ${when}.`, url: withOrg("/conducting", s.org_id) });
  }
  revalidatePath("/", "layout");
  redirect(withOrg(`/conducting?msg=${encodeURIComponent(accept ? `Thank you! You're conducting on ${when}; the presidency was told.` : "Thanks for letting them know.")}`, s.org_id));
}

export async function cancelConduct(fd: FormData) {
  const user = await requirePresidency();
  cancelSwap(Number(fd.get("swap_id")), user.id);
  revalidatePath("/", "layout");
  go("Request withdrawn.");
}

/** How this organization chooses who conducts (by calling, by month or by Sunday of the month), and how firm it is. */
export async function saveConductingSetup(fd: FormData) {
  const user = await requirePresidency();
  const people = new Set(presidencyWithCallings(user.org_id).map((p) => p.id));
  const mode = String(fd.get("mode")) as ConductMode;
  const pick = (prefix: string) =>
    Object.fromEntries(
      [...fd.entries()]
        .filter(([k, v]) => k.startsWith(prefix) && people.has(Number(v)))
        .map(([k, v]) => [k.slice(prefix.length), Number(v)]),
    );
  const before = conductSettings(user.org_id);
  saveConductSettings(user.org_id, {
    mode: CONDUCT_MODES.some(([m]) => m === mode) ? mode : "rotation",
    // Months already past stay as they were; the ones on the form are replaced.
    months: { ...Object.fromEntries(Object.entries(before.months).filter(([k]) => !fd.has(`month_${k}`))), ...pick("month_") },
    sundays: fd.has("sunday_1") ? pick("sunday_") : before.sundays,
    flexible: fd.get("flexible") === "on",
  });
  revalidatePath("/", "layout");
  go("Saved.");
}

/** Flexible schedules: anyone in the presidency sets who conducts a Sunday; the presidency is told. */
export async function changeConductor(fd: FormData) {
  const user = await requirePresidency();
  if (!conductSettings(user.org_id).flexible) go("Changes go through asking someone (the schedule is set to firm).");
  const date = String(fd.get("date") || "");
  const toId = Number(fd.get("to_id"));
  const error = setConductor(user.org_id, date, user.id, toId, todayIn(user.ward.timezone));
  if (error) go(error);
  const who = presidencyWithCallings(user.org_id).find((p) => p.id === toId);
  const everyone = audienceMembers(user.org_id, "presidency").filter((r) => r.id !== user.id);
  await notify(everyone, {
    title: `${who?.id === user.id ? "Conducting" : `${who?.name ?? "Someone"} is conducting`} ${formatDate(date, "short")}`,
    body: `${user.display_name} set ${who?.id === user.id ? "themselves" : who?.name ?? "someone"} to conduct on ${formatDate(date)}.`,
    url: withOrg("/conducting", user.org_id),
  });
  revalidatePath("/", "layout");
  go(`${who?.name ?? "They"} will conduct on ${formatDate(date)}. The presidency was told.`);
}
