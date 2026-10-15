"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audienceMembers, notify } from "@/lib/notify";
import { REQUEST_KINDS } from "@/lib/visit-requests";
import { hasFeature, leadersPhrase, myOrgs } from "@/lib/orgs";
import { deletePlan, notifyVisitorsOfCancel, planForRequest } from "@/lib/planned-visits";

function back(msg: string, ok = false): never {
  redirect(`/more/visit?msg=${encodeURIComponent(msg)}${ok ? "&ok=1" : ""}`);
}

export async function requestVisit(fd: FormData) {
  const user = await requireUser();
  const kind = String(fd.get("kind") || "");
  const bestTimes = String(fd.get("best_times") || "").trim().slice(0, 200);
  const note = String(fd.get("note") || "").trim().slice(0, 1000);
  if (!(kind in REQUEST_KINDS)) back("Please choose what you'd like.");
  // Which leaders: one of their organizations (or the bishopric) that takes visit requests.
  const org = myOrgs(user.id).find((o) => o.id === Number(fd.get("org_id")) && hasFeature(o, "visits"));
  if (!org) back("Please choose who you'd like to hear from.");
  const d = db();
  const active = d.prepare("SELECT 1 FROM visit_requests WHERE member_id = ? AND org_id = ? AND status IN ('open','scheduled')").get(user.id, org.id);
  if (active) back(`You already have a request with ${leadersPhrase(org)}. You can cancel it above and send a new one.`);
  d.prepare("INSERT INTO visit_requests (org_id, member_id, kind, best_times, note) VALUES (?, ?, ?, ?, ?)").run(org.id, user.id, kind, bestTimes, note);
  // The note can be personal, so it stays in the app and isn't put in the notification.
  await notify(audienceMembers(org.id, "presidency"), {
    title: "Visit requested",
    body: `${user.display_name} would like ${kind === "home" ? "a visit" : kind === "talk" ? "to talk" : "some help"}.`,
    url: "/admin/visit-requests",
  });
  back(`Your request was sent. Someone from ${leadersPhrase(org)} will reach out to you.`, true);
}

export async function cancelVisitRequest(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("item_id"));
  const req = db().prepare("SELECT org_id FROM visit_requests WHERE id = ? AND member_id = ?").get(id, user.id) as { org_id: number } | undefined;
  const r = db()
    .prepare("UPDATE visit_requests SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND member_id = ? AND status IN ('open','scheduled')")
    .run(id, user.id);
  // A visit was already planned: take it off Upcoming visits and tell whoever was going.
  const plan = r.changes && req ? planForRequest(req.org_id, id) : undefined;
  if (plan && req) {
    deletePlan(req.org_id, plan.id);
    await notifyVisitorsOfCancel(plan);
  }
  back("Your request was cancelled.", true);
}
