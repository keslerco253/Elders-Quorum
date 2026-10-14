import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eq-notes-withdraw-"));

describe("teacher notes when the teacher withdraws", () => {
  let d: import("better-sqlite3").Database;
  beforeAll(async () => {
    d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name) VALUES (1, 'W');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'P', 'Pres', 'p@test.local', 'presidency'),
        (2, 1, 'T', 'Teacher', 't@test.local', 'member');
      INSERT INTO lessons (id, ward_id, date, kind, title, teacher_id) VALUES (1, 1, '2030-03-03', 'talk', 'Abide', 2), (2, 1, '2030-03-10', 'talk', 'Hope', 2);
      INSERT INTO lesson_notes (lesson_id, author_id, body, status, published_body) VALUES (1, 2, 'My notes', 'approved', 'My notes'), (2, 1, 'Written by the presidency', 'approved', 'Written by the presidency');
    `);
  });

  it("removes the teacher's own notes, but not notes someone else wrote", async () => {
    const { declineTeaching } = await import("@/lib/teaching");
    await declineTeaching({ id: 2, display_name: "Teacher" }, { id: 1, org_id: 1, date: "2030-03-03", title: "Abide", teacher_id: 2 }, "Out of town");
    expect(d.prepare("SELECT COUNT(*) AS n FROM lesson_notes WHERE lesson_id = 1").get()).toEqual({ n: 0 });
    await declineTeaching({ id: 2, display_name: "Teacher" }, { id: 2, org_id: 1, date: "2030-03-10", title: "Hope", teacher_id: 2 }, "");
    expect(d.prepare("SELECT body FROM lesson_notes WHERE lesson_id = 2").get()).toEqual({ body: "Written by the presidency" });
  });
});

describe("one-time clean-up of leftover notes", () => {
  it("removes notes from people who aren't teaching the lesson any more, keeps leaders' and current teachers'", async () => {
    const { migrate } = await import("@/lib/db");
    const { migrations } = await import("@/lib/db/migrations");
    const Database = (await import("better-sqlite3")).default;
    const d = new Database(":memory:");
    migrate(d, 18);
    d.exec(`
      INSERT INTO wards (id, name) VALUES (1, 'W');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'P', 'Pres', 'p@x', 'presidency'), (2, 1, 'A', 'A', 'a@x', 'member'), (3, 1, 'B', 'B', 'b@x', 'member');
      INSERT INTO lessons (id, ward_id, date, kind, teacher_id) VALUES (1, 1, '2030-01-06', 'talk', NULL), (2, 1, '2030-01-13', 'talk', 3), (3, 1, '2030-01-20', 'talk', NULL), (4, 1, '2030-01-27', 'talk', NULL);
      INSERT INTO lesson_declines (lesson_id, member_id) VALUES (4, 1);
      INSERT INTO lesson_notes (lesson_id, author_id, body) VALUES (1, 2, 'left behind'), (2, 3, 'current teacher'), (3, 1, 'leader wrote it'), (4, 1, 'leader who withdrew');
    `);
    d.exec(migrations.find((m) => m.id === 19)!.sql);
    expect((d.prepare("SELECT body FROM lesson_notes ORDER BY lesson_id").all() as { body: string }[]).map((r) => r.body)).toEqual(["current teacher", "leader wrote it"]);
  });
});
