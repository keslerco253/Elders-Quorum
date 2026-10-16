import { beforeAll, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { manualUrl, parseCfmContents, parseCfmPage, usesCfm } from "@/lib/cfm";

// Twelve weeks in the manual's own layouts: the title on the next line, or on the same line.
const PASTED = [
  "Introduction",
  "December 29–January 4: Introduction to the Old Testament",
  "“The Old Testament Testifies of Jesus Christ”",
  "January 5–11: Moses 1; Abraham 3",
  "“This Is My Work and My Glory”",
  "January 12–18: Genesis 1–2; Moses 2–3 “In the Beginning God Created the Heaven and the Earth”",
  ...Array.from({ length: 9 }, (_, i) => {
    const start = DateTime.fromISO("2026-01-19").plus({ weeks: i });
    const end = start.plus({ days: 6 });
    return `${start.toFormat("LLLL d")}–${start.month === end.month ? end.toFormat("d") : end.toFormat("LLLL d")}: Reading ${i + 4}\n“Title ${i + 4}”`;
  }),
].join("\n");

describe("Come, Follow Me schedule", () => {
  it("reads pasted contents into weeks, each ending on its Sunday", () => {
    const weeks = parseCfmContents(PASTED, 2026);
    expect(weeks).toHaveLength(12);
    expect(weeks[0]).toEqual({
      sunday: "2026-01-04",
      start: "2025-12-29",
      reading: "Introduction to the Old Testament",
      theme: "“The Old Testament Testifies of Jesus Christ”",
      url: `${manualUrl(2026)}/01?lang=eng`,
    });
    expect(weeks[1]).toMatchObject({ sunday: "2026-01-11", reading: "Moses 1; Abraham 3", theme: "“This Is My Work and My Glory”" });
    expect(weeks[2]).toMatchObject({ sunday: "2026-01-18", reading: "Genesis 1–2; Moses 2–3", theme: "“In the Beginning God Created the Heaven and the Earth”" });
    expect(weeks.at(-1)).toMatchObject({ sunday: "2026-03-22", reading: "Reading 12" });
    expect(weeks.every((w) => DateTime.fromISO(w.sunday).weekday === 7)).toBe(true);
  });

  it("reads the manual's web page, keeping each week's own link", () => {
    const base = "/study/manual/come-follow-me-for-home-and-church-old-testament-2026";
    const html = `<nav><a href="${base}/title-page?lang=eng">Title Page</a>${parseCfmContents(PASTED, 2026)
      .map(
        (w, i) =>
          `<li><a href="${base}/${String(i + 1).padStart(2, "0")}?lang=eng&amp;x=1"><p class="title">${DateTime.fromISO(w.start).toFormat("LLLL d")}&ndash;${DateTime.fromISO(w.sunday).toFormat(
            w.start.slice(5, 7) === w.sunday.slice(5, 7) ? "d" : "LLLL d",
          )}: ${w.reading}</p><p class="subtitle">${w.theme}</p></a></li>`,
      )
      .join("")}</nav>`;
    const weeks = parseCfmPage(html, 2026);
    expect(weeks).toHaveLength(12);
    expect(weeks[1]).toMatchObject({ sunday: "2026-01-11", reading: "Moses 1; Abraham 3", theme: "“This Is My Work and My Glory”", url: `https://www.churchofjesuschrist.org${base}/02?lang=eng&x=1` });
  });

  it("knows each year's manual and only Sunday School uses it", () => {
    expect(manualUrl(2027)).toContain("new-testament-2027");
    expect(manualUrl(2029)).toContain("doctrine-and-covenants-2029");
    expect(usesCfm({ kind: "group", name: "Sunday School" })).toBe(true);
    expect(usesCfm({ kind: "group", name: "Elders Quorum" })).toBe(false);
  });
});

describe("Sunday School lessons from Come, Follow Me", () => {
  let d: import("better-sqlite3").Database;
  let cfm: typeof import("@/lib/cfm");
  let collectDue: typeof import("@/lib/scheduler").collectDue;
  beforeAll(async () => {
    d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@t.l', 'presidency'), (2, 1, 'M', 'Mem', 'm@t.l', 'member');
    `);
    d.exec("UPDATE orgs SET active = 1 WHERE id = 7; INSERT INTO org_members (org_id, member_id) VALUES (7, 1), (7, 2);");
    cfm = await import("@/lib/cfm");
    ({ collectDue } = await import("@/lib/scheduler"));
    cfm.saveCfmSchedule(parseCfmContents(PASTED, 2026));
  });
  const lesson = (date: string) => d.prepare("SELECT kind, title, speaker, url, cfm_auto FROM lessons WHERE org_id = 7 AND date = ?").get(date) as Record<string, unknown>;

  it("fills every week, and leaves lessons changed by hand alone", () => {
    expect(cfm.ensureCfmLessons(7, "2026-01-05")).toBe(11);
    expect(lesson("2026-01-11")).toMatchObject({ kind: "talk", title: "Moses 1; Abraham 3", speaker: "“This Is My Work and My Glory”", cfm_auto: 1 });
    expect(lesson("2026-01-04")).toBeUndefined();
    // Elders Quorum isn't touched.
    expect((d.prepare("SELECT COUNT(*) AS n FROM lessons WHERE org_id <> 7").get() as { n: number }).n).toBe(0);

    d.prepare("UPDATE lessons SET title = 'Ward choir special', cfm_auto = 0 WHERE org_id = 7 AND date = '2026-01-18'").run();
    cfm.saveCfmSchedule(parseCfmContents(PASTED.replace("Moses 1; Abraham 3", "Moses 1 and Abraham 3"), 2026));
    expect(lesson("2026-01-11")).toMatchObject({ title: "Moses 1 and Abraham 3" });
    expect(lesson("2026-01-18")).toMatchObject({ title: "Ward choir special" });
    expect(cfm.ensureCfmLessons(7, "2026-01-05")).toBe(0);

    const id = (d.prepare("SELECT id FROM lessons WHERE org_id = 7 AND date = '2026-01-18'").get() as { id: number }).id;
    expect(cfm.refillCfmLesson(7, id)).toBe(true);
    expect(lesson("2026-01-18")).toMatchObject({ title: "Genesis 1–2; Moses 2–3", cfm_auto: 1 });
    expect(cfm.cfmWeekOf("2026-01-14")?.sunday).toBe("2026-01-18");
  });

  it("reminds Sunday School of the week's reading on Sunday evening, and of class only when a teacher is set", () => {
    const at = (t: string) => DateTime.fromISO(t, { zone: "America/Boise" }).toUTC();
    const sun = collectDue(at("2026-01-11T19:00")).filter((n) => n.key.startsWith("lesson-sun:7:"));
    expect(sun).toHaveLength(1);
    expect(sun[0].payload.title).toBe("This week's Come, Follow Me: Genesis 1–2; Moses 2–3");
    expect(sun[0].payload.body).toBe("“In the Beginning God Created the Heaven and the Earth” Tap to read this week's lesson.");
    expect(sun[0].recipients.map((r) => r.id).sort()).toEqual([1, 2]);
    expect(collectDue(at("2026-01-17T08:00")).filter((n) => n.key.startsWith("lesson-sat:7:"))).toHaveLength(0);
    d.prepare("UPDATE lessons SET teacher_id = 1 WHERE org_id = 7 AND date = '2026-01-18'").run();
    expect(collectDue(at("2026-01-17T08:00")).filter((n) => n.key.startsWith("lesson-sat:7:"))).toHaveLength(1);
  });
});
