import { beforeEach, describe, expect, it } from "vitest";
import { useTestDb } from "@/lib/db";
import { getNotes, publishNotes, rejectNotes, submitNotes } from "@/lib/lesson-notes";
import { runRetention } from "@/lib/retention";

describe("teacher notes", () => {
  beforeEach(() => {
    const d = useTestDb();
    d.exec(`
      INSERT INTO wards (id, name) VALUES (1, 'W');
      INSERT INTO members (id, ward_id, name, display_name, role) VALUES (1, 1, 'T', 'Teacher', 'member'), (2, 1, 'A', 'Admin', 'admin');
      INSERT INTO lessons (id, ward_id, date, teacher_id) VALUES (1, 1, date('now', '+5 days'), 1), (2, 1, date('now', '-7 months'), 1);
    `);
  });

  it("keeps drafts hidden until approved and notifies only on first publish", () => {
    submitNotes(1, 1, "Read Alma 32");
    expect(getNotes(1)).toMatchObject({ status: "pending", published_body: null });
    expect(publishNotes(1, 2)).toBe(true);
    expect(getNotes(1)).toMatchObject({ status: "approved", published_body: "Read Alma 32" });

    submitNotes(1, 1, "Read Alma 32 and Ether 12");
    expect(getNotes(1)).toMatchObject({ status: "pending", published_body: "Read Alma 32" });
    rejectNotes(1, 2, "Please shorten");
    expect(getNotes(1)).toMatchObject({ status: "rejected", review_note: "Please shorten", published_body: "Read Alma 32" });
    submitNotes(1, 1, "Read Ether 12");
    expect(publishNotes(1, 2)).toBe(false);
    expect(getNotes(1)?.published_body).toBe("Read Ether 12");
  });

  it("is deleted 6 months after the lesson", () => {
    submitNotes(2, 1, "old");
    submitNotes(1, 1, "new");
    runRetention();
    expect(getNotes(2)).toBeUndefined();
    expect(getNotes(1)).toBeDefined();
  });
});
