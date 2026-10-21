import { describe, expect, it } from "vitest";
import { db, useTestDb } from "@/lib/db";
import { clearWardCalendar, clearWardMessages, clearWardService } from "@/lib/orgs";

describe("clearing a ward's messages before going live", () => {
  it("deletes messages, conversations and alerts in that ward only; calendar and service stay", () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas', 'America/Boise'), (2, 'Other', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (2, 2, 'O', 'Other', 'o@x.com', 'presidency');
      INSERT INTO events (ward_id, title, starts_at, ends_at) VALUES (1, 'Temple night', '2026-11-01T02:00:00Z', '2026-11-01T04:00:00Z');
      INSERT INTO signups (ward_id, title) VALUES (1, 'Meals');
    `);
    const d = db();
    const org = (w: number) => (d.prepare("SELECT id FROM orgs WHERE ward_id = ? LIMIT 1").get(w) as { id: number }).id;
    for (const [w, m] of [
      [1, 1],
      [2, 2],
    ]) {
      const id = d.prepare("INSERT INTO messages (org_id, sender_id, audience, audience_label, title, body) VALUES (?, ?, 'everyone', 'Everyone', 'Hi', 'Hello')").run(org(w), m).lastInsertRowid;
      d.prepare("INSERT INTO message_recipients (message_id, member_id) VALUES (?, ?)").run(id, m);
      d.prepare("INSERT INTO member_messages (org_id, member_id, direction, body) VALUES (?, ?, 'in', 'Thanks')").run(org(w), m);
      d.prepare("INSERT INTO notification_log (member_id, org_id, title, body, url) VALUES (?, ?, 'Reminder', 'x', '/')").run(m, org(w));
    }
    expect(clearWardMessages(1)).toEqual({ messages: 1, conversations: 1, alerts: 1 });
    const count = (t: string) => (d.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
    expect([count("messages"), count("message_recipients"), count("member_messages"), count("notification_log")]).toEqual([1, 1, 1, 1]);
    expect([count("events"), count("signups")]).toEqual([1, 1]);
  });

  it("clears the calendar and service separately, in that ward only", () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas', 'America/Boise'), (2, 'Other', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency');
      INSERT INTO events (ward_id, title, starts_at, ends_at) VALUES (1, 'Temple night', '2026-11-01T02:00:00Z', '2026-11-01T04:00:00Z'), (2, 'Theirs', '2026-11-01T02:00:00Z', '2026-11-01T04:00:00Z');
      INSERT INTO signups (id, ward_id, title) VALUES (1, 1, 'Meals'), (2, 2, 'Theirs');
      INSERT INTO signup_slots (signup_id, label, capacity) VALUES (1, 'Dinner', 2);
      INSERT INTO plans (ward_id, kind, title) VALUES (1, 'temple', 'Temple plan');
    `);
    const count = (t: string) => (db().prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
    expect(clearWardCalendar(1)).toEqual({ events: 1 });
    expect([count("events"), count("signups")]).toEqual([1, 2]);
    expect(clearWardService(1)).toEqual({ signups: 1 });
    expect([count("signups"), count("signup_slots"), count("plans")]).toEqual([1, 0, 1]);
  });
});
