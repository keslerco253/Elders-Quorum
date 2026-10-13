"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audienceMembers, notify } from "@/lib/notify";
import { REQUEST_KINDS } from "@/lib/visit-requests";

function back(msg: string, ok = false): never {
  redirect(`/more/visit?msg=${encodeURIComponent(msg)}${ok ? "&ok=1" : ""}`);
}

export async function requestVisit(fd: FormData) {
  const user = await requireUser();
  const kind = String(fd.get("kind") || "");
  const bestTimes = String(fd.get("best_times") || "").trim().slice(0, 200);
  const note = String(fd.get("note") || "").trim().slice(0, 1000);
  if (!(kind in REQUEST_KINDS)) back("Please choose what you'd like.");
  const d = db();
  const active = d.prepare("SELECT 1 FROM visit_requests WHERE member_id = ? AND status IN ('open','scheduled')").get(user.id);
  if (active) back("You already have a request with the presidency. You can cancel it below and send a new one.");
  d.prepare("INSERT INTO visit_requests (ward_id, member_id, kind, best_times, note) VALUES (?, ?, ?, ?, ?)").run(user.ward_id, user.id, kind, bestTimes, note);
  // The note can be personal, so it stays in the app and isn't put in the notification.
  await notify(audienceMembers(user.ward_id, "presidency"), {
    title: "Visit requested",
    body: `${user.display_name} would like ${kind === "home" ? "a visit" : kind === "talk" ? "to talk" : "some help"}.`,
    url: "/admin/visit-requests",
  });
  back("Your request was sent. A member of the presidency will reach out to you.", true);
}

export async function cancelVisitRequest(fd: FormData) {
  const user = await requireUser();
  db()
    .prepare("UPDATE visit_requests SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND member_id = ? AND status IN ('open','scheduled')")
    .run(Number(fd.get("item_id")), user.id);
  back("Your request was cancelled.", true);
}
