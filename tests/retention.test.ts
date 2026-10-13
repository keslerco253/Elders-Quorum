import { beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { useTestDb } from "@/lib/db";
import { runRetention } from "@/lib/retention";
import { deleteAccount } from "@/lib/accounts";

let d: Database.Database;
const count = (t: string) => (d.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;

describe("privacy retention", () => {
  beforeEach(() => {
    d = useTestDb();
    d.exec(`
      INSERT INTO wards (id, name) VALUES (1, 'W');
      INSERT INTO members (id, ward_id, name, display_name, email, role, last_login_at) VALUES
        (1, 1, 'Pres', 'Pres', 'p@x', 'presidency', datetime('now')),
        (2, 1, 'Recent', 'Recent', 'r@x', 'member', datetime('now', '-10 days')),
        (3, 1, 'Stale', 'Stale', 's@x', 'member', datetime('now', '-400 days')),
        (4, 1, 'OldLeader', 'OldLeader', 'o@x', 'admin', datetime('now', '-400 days'));
      INSERT INTO lessons (id, ward_id, date) VALUES (1, 1, date('now', '-8 months')), (2, 1, date('now', '-40 days')), (3, 1, date('now', '+7 days'));
      INSERT INTO comments (lesson_id, member_id, body, status) VALUES (1, 2, 'old', 'approved'), (2, 2, 'recent', 'approved'), (3, 2, 'new', 'pending');
      INSERT INTO lesson_volunteers (lesson_id, member_id) VALUES (2, 2), (3, 2);
      INSERT INTO events (id, ward_id, title, starts_at, ends_at, created_by) VALUES
        (1, 1, 'old', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-60 days'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-60 days'), 3),
        (2, 1, 'soon', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '+5 days'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '+5 days'), 1);
      INSERT INTO event_rsvps (event_id, member_id, response) VALUES (1, 2, 'yes'), (2, 2, 'yes');
      INSERT INTO signups (id, ward_id, title, date) VALUES (1, 1, 'old', date('now', '-45 days')), (2, 1, 'soon', date('now', '+3 days'));
    `);
  });

  it("deletes old contributions and stale member accounts, keeps current ones", () => {
    runRetention();
    expect((d.prepare("SELECT body FROM comments ORDER BY id").all() as { body: string }[]).map((r) => r.body)).toEqual(["recent", "new"]);
    expect(count("lesson_volunteers")).toBe(1);
    expect(count("event_rsvps")).toBe(1);
    expect(count("signups")).toBe(1);
    expect((d.prepare("SELECT id FROM members ORDER BY id").all() as { id: number }[]).map((r) => r.id)).toEqual([1, 2, 4]);
    // The stale member's event stays, without pointing at them.
    expect(d.prepare("SELECT created_by FROM events WHERE id = 1").get()).toEqual({ created_by: null });
  });

  it("keeps active visit requests and deletes finished or very old ones", () => {
    d.exec(`
      INSERT INTO visit_requests (ward_id, member_id, kind, status, created_at, updated_at, handled_by) VALUES
        (1, 2, 'home', 'open', datetime('now', '-20 days'), datetime('now', '-20 days'), NULL),
        (1, 2, 'talk', 'done', datetime('now', '-50 days'), datetime('now', '-40 days'), 1),
        (1, 2, 'help', 'closed', datetime('now', '-10 days'), datetime('now', '-5 days'), 1),
        (1, 2, 'home', 'open', datetime('now', '-7 months'), datetime('now', '-7 months'), NULL);
    `);
    runRetention();
    expect((d.prepare("SELECT kind, status FROM visit_requests ORDER BY id").all() as object[])).toEqual([
      { kind: "home", status: "open" },
      { kind: "help", status: "closed" },
    ]);
    // A presidency member being deleted leaves the request in place.
    deleteAccount(1);
    expect(count("visit_requests")).toBe(2);
    deleteAccount(2);
    expect(count("visit_requests")).toBe(0);
  });

  it("deletes an account and everything the member posted", () => {
    deleteAccount(2);
    expect(count("comments")).toBe(0);
    expect(count("lesson_volunteers")).toBe(0);
    expect(count("event_rsvps")).toBe(0);
  });
});
