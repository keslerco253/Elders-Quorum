import { DateTime } from "luxon";
import { db } from "./db";
import { addToOrg, createWard, deleteWard, orgsInWard } from "./orgs";
import { createPlan, saveVersion } from "./plans";
import { sundayOnOrAfter } from "./time";
import { ensureCfmLessons } from "./cfm";

// For Apple's and Google's app reviewers: a ward of made-up people with sample
// lessons, events, a service sign-up and a plan, and a member account they sign
// in to (REVIEW_LOGIN). Nobody real is in it, and none of the made-up people
// have an email or phone, so nothing is ever sent to them.

export const DEMO_WARD_NAME = "Maple Grove Ward (Demo)";

const PEOPLE = ["Bishop Daniel Reyes", "Brother Samuel Ortiz", "Brother James Whitaker", "Brother Luke Hansen", "Sister Emily Carter", "Sister Grace Lin", "Sister Hannah Moore", "Brother Noah Bennett"];

export function demoWard(): { id: number } | undefined {
  return db().prepare("SELECT id FROM wards WHERE demo = 1 ORDER BY id LIMIT 1").get() as { id: number } | undefined;
}

/** Only an account that is in demo wards and nowhere else may use the review sign-in. */
export function onlyInDemoWards(memberId: number) {
  const r = db()
    .prepare("SELECT COUNT(*) AS n, SUM(w.demo) AS demo FROM ward_members wm JOIN wards w ON w.id = wm.ward_id WHERE wm.member_id = ?")
    .get(memberId) as { n: number; demo: number | null };
  return r.n > 0 && r.demo === r.n;
}

/** Builds (or rebuilds) the demo ward, with the reviewer's account in it. */
export function setUpReviewDemo(reviewerEmail: string, timezone: string): { wardId: number; reviewerId: number } {
  const d = db();
  const email = reviewerEmail.trim().toLowerCase();
  // An account with that email outside the demo is someone real: never reuse it.
  const taken = d.prepare("SELECT id FROM members WHERE lower(email) = ?").get(email) as { id: number } | undefined;
  if (taken && !onlyInDemoWards(taken.id)) throw new Error("That email already belongs to an account. Use a different one for the reviewer.");
  const old = demoWard();
  if (old) deleteWard(old.id);
  return d.transaction(() => {
    const person = d.prepare("INSERT INTO members (name, display_name, contact_pref, source) VALUES (?, ?, 'none', 'setup')");
    const ids = PEOPLE.map((n) => Number(person.run(n.replace(/^(Bishop|Brother|Sister) /, ""), n).lastInsertRowid));
    const ward = createWard({ name: DEMO_WARD_NAME, timezone, creatorId: ids[0], calling: "bishop" });
    d.prepare("UPDATE wards SET demo = 1, texting_enabled = 0 WHERE id = ?").run(ward.id);
    const reviewerId = Number(
      d
        .prepare("INSERT INTO members (name, display_name, email, email_verified_at, contact_pref, source) VALUES ('Reviewer, App', 'App Reviewer', ?, datetime('now'), 'email', 'setup')")
        .run(email).lastInsertRowid,
    );
    const orgs = orgsInWard(ward.id, { includeInactive: true });
    const org = (name: string) => orgs.find((o) => o.name === name)!;
    d.prepare("UPDATE orgs SET active = 1 WHERE ward_id = ? AND name IN ('Elders Quorum', 'Relief Society', 'Sunday School')").run(ward.id);
    const eq = org("Elders Quorum");
    const rs = org("Relief Society");
    const men = [ids[1], ids[2], ids[3], ids[7]];
    const women = [ids[4], ids[5], ids[6]];
    addToOrg(ids[1], eq.id, { role: "presidency", calling: "president" });
    addToOrg(ids[2], eq.id, { role: "presidency", calling: "first_counselor" });
    for (const id of men) addToOrg(id, eq.id);
    addToOrg(ids[4], rs.id, { role: "presidency", calling: "president" });
    for (const id of women) addToOrg(id, rs.id);
    for (const id of ids) addToOrg(id, org("Sunday School").id);
    addToOrg(reviewerId, eq.id);
    addToOrg(reviewerId, org("Sunday School").id);

    // Lessons: the next six Sundays, a couple with teachers.
    const today = DateTime.now().setZone(timezone).toISODate()!;
    const first = sundayOnOrAfter(today);
    const topics = ["Faith in Jesus Christ", "The Blessings of Ministering", "Prayer and Personal Revelation", "Strengthening Families", "Gratitude", "Serving One Another"];
    const lesson = d.prepare("INSERT INTO lessons (org_id, date, title, teacher_id) VALUES (?, ?, ?, ?)");
    topics.forEach((t, i) => lesson.run(eq.id, DateTime.fromISO(first).plus({ weeks: i }).toISODate(), t, i === 0 ? ids[3] : i === 2 ? ids[7] : null));

    // Sunday School: Come, Follow Me (once the site owner has loaded the schedule).
    ensureCfmLessons(org("Sunday School").id, today);

    // Events: a service project, a ward activity and a Relief Society night.
    const at = (days: number, hour: number) => DateTime.fromISO(today, { zone: timezone }).plus({ days }).set({ hour });
    const event = d.prepare("INSERT INTO events (org_id, title, description, location, starts_at, ends_at, rsvp_enabled, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    const ev = (orgId: number, title: string, desc: string, where: string, days: number, hour: number, hours: number, rsvp: number) => {
      const s = at(days, hour);
      event.run(orgId, title, desc, where, s.toUTC().toISO(), s.plus({ hours }).toUTC().toISO(), rsvp, ids[1]);
    };
    ev(eq.id, "Yard cleanup service project", "Bring gloves and a rake. Lunch provided.", "Maple Grove Park", 6, 9, 3, 1);
    ev(org("Ward").id, "Ward chili cook-off", "Bring a pot of your best chili or a side to share.", "Church cultural hall", 13, 18, 2, 1);
    ev(rs.id, "Relief Society activity: Bread making", "Learn to make simple homemade bread.", "Carter home", 9, 19, 2, 0);

    // A service opportunity to sign up for.
    const signup = Number(
      d.prepare("INSERT INTO signups (org_id, title, description, date, created_by) VALUES (?, ?, ?, ?, ?)").run(eq.id, "Help the Bennetts move", "They're moving across town on Saturday morning.", at(8, 9).toISODate(), ids[1]).lastInsertRowid,
    );
    const slot = d.prepare("INSERT INTO signup_slots (signup_id, label, capacity, position) VALUES (?, ?, ?, ?)");
    slot.run(signup, "Loading the truck", 4, 0);
    slot.run(signup, "Bring a truck or trailer", 2, 1);
    slot.run(signup, "Bring lunch for the helpers", 1, 2);
    const s1 = (d.prepare("SELECT id FROM signup_slots WHERE signup_id = ? ORDER BY position LIMIT 1").get(signup) as { id: number }).id;
    d.prepare("INSERT INTO signup_entries (slot_id, member_id) VALUES (?, ?), (?, ?)").run(s1, ids[2], s1, ids[3]);

    // A ward plan page.
    const plan = createPlan(ward.id, "Ward Goals This Year", [], ids[0]);
    saveVersion({
      planId: plan,
      orgId: org("Ward").id,
      title: "Ward Goals This Year",
      createdBy: ids[0],
      blocks: [
        { id: "a", type: "heading", text: "Our goals" },
        { id: "b", type: "text", text: "- Visit every family in the ward by the end of the year\n- Hold a ward temple day each quarter\n- Help every youth attend a summer camp" },
        { id: "c", type: "divider" },
        { id: "d", type: "text", text: "Talk to any member of the bishopric with ideas." },
      ],
    });
    return { wardId: ward.id, reviewerId };
  })();
}
