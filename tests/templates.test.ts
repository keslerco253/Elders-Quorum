import { beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eq-tmpl-"));

describe("message wording", () => {
  it("fills in details and drops [bracketed] parts when something is blank", async () => {
    const { fillTemplate } = await import("@/lib/template-defs");
    expect(fillTemplate("Reminder: {event}", { event: "Party" })).toBe("Reminder: Party");
    expect(fillTemplate("{date_time}[ at {location}]", { date_time: "Sat 6 PM", location: "" })).toBe("Sat 6 PM");
    expect(fillTemplate("{date_time}[ at {location}]", { date_time: "Sat 6 PM", location: "the gym" })).toBe("Sat 6 PM at the gym");
    expect(fillTemplate("[By {speaker}.] [Taught by {teacher}.] Tap to read.", { speaker: null, teacher: "Sam" })).toBe("Taught by Sam. Tap to read.");
    // A typo stays visible instead of disappearing.
    expect(fillTemplate("Hi {frist_name}!", { first_name: "Hyrum" })).toBe("Hi {frist_name}!");
  });

  describe("per organization", () => {
    let t: typeof import("@/lib/templates");
    let eq: number;
    let rs: number;
    beforeEach(async () => {
      const d = (await import("@/lib/db")).useTestDb();
      const orgs = await import("@/lib/orgs");
      t = await import("@/lib/templates");
      d.exec("INSERT INTO members (id, name, display_name, email, status, contact_pref) VALUES (1, 'P', 'Pres', 'p@test.local', 'active', 'email')");
      const w = orgs.createWard({ name: "Villas Ward", timezone: "America/Boise", creatorId: 1 });
      eq = orgs.createOrg(w.id, "Elders Quorum").id;
      rs = orgs.createOrg(w.id, "Relief Society").id;
    });

    it("uses an organization's own wording, and goes back to the app's on reset", () => {
      const vars = { event: "Service project", date_time: "Sat 9 AM", location: "" };
      expect(t.renderTemplate(eq, "event_reminder", vars)).toEqual({ title: "Reminder: Service project", body: "Sat 9 AM" });
      t.saveTemplate(eq, "event_reminder", "Don't forget: {event}!", "See you {date_time}[ at {location}].", 1);
      expect(t.renderTemplate(eq, "event_reminder", vars)).toEqual({ title: "Don't forget: Service project!", body: "See you Sat 9 AM." });
      expect(t.renderTemplate(rs, "event_reminder", vars).title).toBe("Reminder: Service project");
      t.resetTemplate(eq, "event_reminder");
      expect(t.orgTemplate(eq, "event_reminder").custom).toBe(false);
    });
  });
});
