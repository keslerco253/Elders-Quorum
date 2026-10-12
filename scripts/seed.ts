// Fills an EMPTY database with made-up demo data for previewing the app.
// Usage: npm run seed                         (refuses if the database already has data)
//        npm run seed -- --email you@gmail.com  makes you the demo presidency member
//        npm run seed -- --session              also prints sign-in cookies (testing)
// In Docker: docker compose exec app node seed.js --email you@gmail.com
import { DateTime } from "luxon";
import { db } from "../src/lib/db";
import { createSession } from "../src/lib/auth-core";
import { sundays } from "../src/lib/time";

const d = db();
if ((d.prepare("SELECT COUNT(*) AS n FROM wards").get() as { n: number }).n > 0) {
  console.error("The database already has data. Seed only runs on an empty database.");
  process.exit(1);
}

const TZ = "America/Boise";
const now = DateTime.now().setZone(TZ);
const ward = Number(d.prepare("INSERT INTO wards (name, timezone) VALUES (?, ?)").run("Villas Ward Elders Quorum", TZ).lastInsertRowid);

const people: [string, string?][] = [
  ["Carter, Daniel", "presidency"],
  ["Nguyen, Michael", "presidency"],
  ["Hansen, Tyler", "presidency"],
  ["Ortiz, Samuel", "presidency"],
  ["Whitaker, Robert", "admin"],
  ["Lindqvist, Erik", "admin"],
  ["Abbott, James"], ["Bennett, Luke"], ["Castillo, Mateo"], ["Dawson, Henry"], ["Ellis, Noah"], ["Fischer, Adam"],
  ["Garner, Owen"], ["Holt, Caleb"], ["Iverson, Jacob"], ["Jensen, Ethan"], ["Kimball, Wyatt"], ["Lopez, Gabriel"],
  ["Morrison, Isaac"], ["Nash, Levi"], ["Olsen, Aaron"], ["Pratt, Dylan"],
];
const ids: number[] = [];
people.forEach(([name, role = "member"], i) => {
  const [last, first] = name.split(", ");
  const joined = i < 16 ? now.minus({ days: 10 - (i % 7) }).toUTC().toISO() : null;
  ids.push(
    Number(
      d
        .prepare("INSERT INTO members (ward_id, name, display_name, email, phone, address, role, source, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'import', ?)")
        .run(ward, name, `${first} ${last}`, i === 21 ? null : `${first}.${last}@example.com`.toLowerCase(), `208-555-01${String(i).padStart(2, "0")}`, `${100 + i * 7} W Example St, Boise, ID 83709`, role, joined).lastInsertRowid,
    ),
  );
});
d.prepare("UPDATE members SET is_site_owner = 1 WHERE id = ?").run(ids[0]);
const emailArg = process.argv.indexOf("--email");
if (emailArg > 0 && process.argv[emailArg + 1]) {
  d.prepare("UPDATE members SET email = ? WHERE id = ?").run(process.argv[emailArg + 1].toLowerCase(), ids[0]);
  console.log(`You can sign in as the demo president (Daniel Carter) with ${process.argv[emailArg + 1]}.`);
}
d.prepare("INSERT INTO members (ward_id, name, display_name, email, status, source, request_note) VALUES (?, ?, ?, ?, 'pending', 'request', ?)").run(
  ward, "Ramirez, Sofia", "Sofia Ramirez", "sofia.ramirez@example.com", "My husband is in the quorum and I'd like to follow the lessons too.",
);

// Lessons: 26 Sundays starting last Sunday.
const titles = [
  "Example Talk: Abiding in His Love", "Example Talk: The Power of Covenants", "Example Talk: Ministering Like the Savior", "Example Talk: Faith to Move Forward",
  "Example Talk: Hearing Him", "Example Talk: The Blessings of the Temple", "Example Talk: Repentance Is a Joy", "Example Talk: Gathering Israel",
  "Example Talk: Peace in Christ", "Example Talk: Strengthening Families", "Example Talk: The Sabbath Is a Delight", "Example Talk: Becoming Peacemakers",
];
const speakers = ["Elder Example A", "President Example B", "Sister Example C", "Elder Example D"];
const start = sundays(now.minus({ days: 7 }).toISODate()!, 1)[0];
sundays(start, 26).forEach((date, i) => {
  const kind = i === 6 ? "stake_conference" : i === 25 ? "general_conference" : "talk";
  const teacher = kind === "talk" && i < 8 && i !== 3 ? ids[6 + (i % 10)] : null;
  const id = Number(
    d.prepare("INSERT INTO lessons (ward_id, date, kind, title, speaker, url, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      ward, date, kind, kind === "talk" ? titles[i % titles.length] : "", kind === "talk" ? speakers[i % 4] : "",
      kind === "talk" ? "https://www.churchofjesuschrist.org/study/general-conference?lang=eng" : "", teacher,
    ).lastInsertRowid,
  );
  if (i === 3) {
    d.prepare("INSERT INTO lesson_volunteers (lesson_id, member_id) VALUES (?, ?), (?, ?)").run(id, ids[9], id, ids[12]);
  }
  if (i === 1) {
    const c1 = Number(d.prepare("INSERT INTO comments (lesson_id, member_id, body, status) VALUES (?, ?, ?, 'approved')").run(id, ids[8], "I loved the reminder that covenants aren't a checklist but a relationship. It changed how I prepared for the sacrament this week.").lastInsertRowid);
    d.prepare("INSERT INTO comments (lesson_id, parent_id, member_id, body, status) VALUES (?, ?, ?, ?, 'approved')").run(id, c1, ids[1], "Great insight, Mateo. That idea of relationship over checklist really stood out to me too.");
    d.prepare("INSERT INTO comments (lesson_id, member_id, body, status) VALUES (?, ?, ?, 'pending')").run(id, ids[10], "Question for Sunday: how do we help our kids feel the same about their baptismal covenants?");
  }
});

// Events
const ev = (daysAhead: number, hour: number, len: number, title: string, location: string, description: string, presidencyOnly = 0, rsvp = 0) => {
  const s = now.startOf("day").plus({ days: daysAhead, hours: hour });
  d.prepare("INSERT INTO events (ward_id, title, description, location, starts_at, ends_at, presidency_only, rsvp_enabled, reminder_minutes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1440, ?)").run(
    ward, title, description, location, s.toUTC().toISO(), s.plus({ hours: len }).toUTC().toISO(), presidencyOnly, rsvp, ids[0],
  );
};
ev(3, 19, 1, "Presidency meeting", "Bishop's office", "Agenda: lesson schedule, ministering needs, temple night.", 1);
ev(5, 9, 3, "Service project: yard cleanup", "123 Example Ln", "Bring gloves, rakes and leaf bags. Donuts provided!", 0, 1);
ev(12, 18.5, 2, "Quorum temple night", "Boise Idaho Temple", "Meet in the parking lot at 6:15.", 0, 1);
ev(19, 19, 1.5, "Quorum basketball", "Stake center gym", "All skill levels welcome.");
ev(26, 18, 2, "Ward Trunk-or-Treat", "Church parking lot", "Elders quorum is running the chili cook-off.");
d.prepare("INSERT INTO event_requests (ward_id, member_id, title, description, location, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
  ward, ids[13], "Pickleball night", "Thought it would be fun to get the quorum together.", "Stake center gym",
  now.startOf("day").plus({ days: 15, hours: 19 }).toUTC().toISO(), now.startOf("day").plus({ days: 15, hours: 21 }).toUTC().toISO(),
);

// Plans
d.prepare("INSERT INTO plans (ward_id, kind, title, body, created_by) VALUES (?, 'temple', ?, ?, ?)").run(
  ward, "Temple & Family History Plan", "## Our goals this year\n- Every family takes one family name to the temple\n- Hold a quorum temple night each month\n- Help 10 members start their FamilySearch tree\n\n## How you can help\n- **Temple night:** second Thursday of each month at 6:30 PM\n- **Family history help:** consultants available after church in the library\n\n> \"Hasten the work\" (an example quote placeholder)", ids[0],
);
d.prepare("INSERT INTO plans (ward_id, kind, title, body, created_by) VALUES (?, 'mission', ?, ?, ?)").run(
  ward, "Ward Mission Plan", "## Focus\nInvite friends to quorum activities and service projects.\n\n## This quarter\n1. Service project open to neighbors\n2. Missionary dinner sign-ups each week\n3. Share a gospel message on social media once a month", ids[0],
);

// Sign-ups
const su = Number(d.prepare("INSERT INTO signups (ward_id, title, description, date, created_by) VALUES (?, ?, ?, ?, ?)").run(ward, "Meals for the Example family", "New baby! Please drop off dinner by 6 PM. No nuts, please.", now.plus({ days: 9 }).toISODate(), ids[0]).lastInsertRowid);
["Monday dinner", "Tuesday dinner", "Wednesday dinner", "Thursday dinner", "Friday dinner"].forEach((l, i) => {
  const slot = Number(d.prepare("INSERT INTO signup_slots (signup_id, label, capacity, position) VALUES (?, ?, 1, ?)").run(su, l, i).lastInsertRowid);
  if (i < 2) d.prepare("INSERT INTO signup_entries (slot_id, member_id, note) VALUES (?, ?, ?)").run(slot, ids[7 + i], i === 0 ? "Lasagna" : "");
});
const su2 = Number(d.prepare("INSERT INTO signups (ward_id, title, description, date, created_by) VALUES (?, ?, ?, ?, ?)").run(ward, "Move-in help", "A family is moving into the ward. Truck arrives at 9 AM.", now.plus({ days: 5 }).toISODate(), ids[0]).lastInsertRowid);
const s1 = Number(d.prepare("INSERT INTO signup_slots (signup_id, label, capacity, position) VALUES (?, 'Helpers', 6, 0)").run(su2).lastInsertRowid);
d.prepare("INSERT INTO signup_slots (signup_id, label, capacity, position) VALUES (?, 'Bring a trailer', 1, 1)").run(su2);
d.prepare("INSERT INTO signup_entries (slot_id, member_id) VALUES (?, ?), (?, ?), (?, ?)").run(s1, ids[8], s1, ids[11], s1, ids[14]);

// Visits and to-dos
const visit = (memberIdx: number, daysAgo: number, type: string, notes: string, followUp = 0, by = [0]) => {
  const v = Number(d.prepare("INSERT INTO visits (ward_id, member_id, date, type, notes, follow_up, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)").run(ward, ids[memberIdx], now.minus({ days: daysAgo }).toISODate(), type, notes, followUp, ids[by[0]]).lastInsertRowid);
  for (const b of by) d.prepare("INSERT INTO visit_visitors (visit_id, member_id) VALUES (?, ?)").run(v, ids[b]);
};
visit(6, 4, "home", "Great visit. Family doing well.", 0, [0, 1]);
visit(9, 20, "home", "Interested in helping with the service project.", 1, [1, 2]);
visit(12, 45, "phone", "Checked in after surgery. Recovering well.", 0, [0]);
visit(15, 90, "home", "", 0, [2, 3]);
d.prepare("INSERT INTO todos (ward_id, title, notes, assignee_id, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?)").run(ward, "Finalize teacher assignments for November", "Check the volunteer list first.", ids[1], now.plus({ days: 2 }).toISODate(), ids[0]);
d.prepare("INSERT INTO todos (ward_id, title, assignee_id, due_date, created_by) VALUES (?, ?, ?, ?, ?)").run(ward, "Order supplies for the service project", ids[2], now.minus({ days: 1 }).toISODate(), ids[0]);
d.prepare("INSERT INTO todos (ward_id, title, assignee_id, created_by, done, done_at) VALUES (?, ?, ?, ?, 1, datetime('now'))").run(ward, "Update the ward mission plan", ids[0], ids[0]);
const g = Number(d.prepare("INSERT INTO groups (ward_id, name) VALUES (?, 'Activities committee')").run(ward).lastInsertRowid);
d.prepare("INSERT INTO group_members (group_id, member_id) VALUES (?, ?), (?, ?), (?, ?)").run(g, ids[7], g, ids[10], g, ids[13]);

console.log(`Seeded demo ward with ${ids.length} members.`);
if (process.argv.includes("--session")) {
  console.log(`presidency=${createSession(ids[0], "year").id}`);
  console.log(`admin=${createSession(ids[4], "year").id}`);
  console.log(`member=${createSession(ids[8], "year").id}`);
}
