import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { db, useTestDb } from "@/lib/db";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eq-suggest-"));

describe("suggestions for the app", () => {
  it("go to the site owner's list, move along, and the person sees what happened", async () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'O', 'Owner', 'o@x.com', 'presidency'), (2, 1, 'M', 'Member Mo', 'm@x.com', 'member');
    `);
    db().prepare("UPDATE members SET is_site_owner = 1 WHERE id = 1").run();
    const org = (db().prepare("SELECT id FROM orgs WHERE kind <> 'ward' LIMIT 1").get() as { id: number }).id;
    const { addSuggestion, mySuggestions, setSuggestionStatus, suggestionCounts, suggestionsWith } = await import("@/lib/suggestions");
    const id = await addSuggestion(2, org, "Show who's teaching in the lesson reminder", "Member Mo");
    // The owner was told.
    expect((db().prepare("SELECT title, url FROM notification_log WHERE member_id = 1").get() as { title: string; url: string })).toEqual({ title: "New suggestion for the app", url: `/site/suggestions#s-${id}` });
    expect(suggestionsWith("new").map((s) => [s.member_name, s.org_name])).toEqual([["Member Mo", "Villas Ward Elders Quorum"]]);
    await setSuggestionStatus(id, "working", "Coming next month", true);
    expect(suggestionCounts()).toEqual({ new: 0, working: 1, done: 0, declined: 0 });
    expect(mySuggestions(2)[0]).toMatchObject({ status: "working", owner_note: "Coming next month" });
    expect((db().prepare("SELECT body FROM notification_log WHERE member_id = 2").get() as { body: string }).body).toContain("is being worked on. Coming next month");
  });
});
