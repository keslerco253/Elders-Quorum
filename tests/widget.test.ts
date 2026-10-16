import { beforeAll, describe, expect, it } from "vitest";
import { DateTime } from "luxon";

describe("home-screen widget feed", () => {
  let d: import("better-sqlite3").Database;
  let w: typeof import("@/lib/widget");
  let core: typeof import("@/lib/auth-core");
  beforeAll(async () => {
    d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@t.l', 'presidency'), (2, 1, 'M', 'Mem', 'm@t.l', 'member');
      INSERT INTO lessons (ward_id, date, kind, title, speaker) VALUES (1, '2026-10-18', 'talk', 'Abide in My Love', 'Elder Christofferson');
      INSERT INTO events (ward_id, title, starts_at, ends_at) VALUES (1, 'Service project', '2026-10-17T16:00:00Z', '2026-10-17T18:00:00Z');
    `);
    d.exec("UPDATE members SET welcomed_at = datetime('now')");
    w = await import("@/lib/widget");
    core = await import("@/lib/auth-core");
  });

  it("signs in with the session's key, and stops when the session ends", () => {
    const { id } = core.createSession(2, "month");
    const key = w.widgetKeyFor(id);
    expect(w.widgetUser(key)?.id).toBe(2);
    expect(w.widgetUser(key.slice(0, -2) + "xx")).toBeNull();
    expect(w.widgetUser(`${"0".repeat(64)}.${key.split(".")[1]}`)).toBeNull();
    expect(w.widgetUser(id)).toBeNull();
    core.deleteSession(id);
    expect(w.widgetUser(key)).toBeNull();
  });

  it("shows this Sunday's lesson and the next event", () => {
    const { id } = core.createSession(2, "month");
    const user = w.widgetUser(w.widgetKeyFor(id))!;
    const data = w.widgetData(user, DateTime.fromISO("2026-10-16T12:00", { zone: "America/Boise" }).toUTC());
    expect(data.lesson).toMatchObject({ org: "Elders Quorum", when: "This Sunday", title: "Abide in My Love", subtitle: "Elder Christofferson" });
    expect(data.lesson?.path).toMatch(/^\/lessons\/\d+\?org=1$/);
    expect(data.event).toMatchObject({ title: "Service project", when: "Tomorrow · 10:00 AM" });
    expect(data.ward).toBe("Villas Ward");
    expect(data.study).toBeNull();
  });
});
