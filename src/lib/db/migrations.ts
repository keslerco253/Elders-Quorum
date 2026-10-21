// Schema migrations. Append new entries; never edit one that has shipped.
/**
 * fkOff: run with foreign keys switched off (needed to rebuild a table others
 * point at); every reference is checked before the migration is kept.
 */
export const migrations: { id: number; sql: string; fkOff?: boolean }[] = [
  {
    id: 1,
    sql: `
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE wards (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Boise',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A member is both a directory entry and (when active with an email) a login.
CREATE TABLE members (
  id INTEGER PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin','presidency')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','inactive','declined')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('import','manual','request','setup')),
  request_note TEXT,
  is_site_owner INTEGER NOT NULL DEFAULT 0,
  theme TEXT NOT NULL DEFAULT 'system',
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX members_ward ON members(ward_id);
CREATE INDEX members_email ON members(email COLLATE NOCASE);

CREATE TABLE login_tokens (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  code_hash TEXT NOT NULL,
  remember TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE plans (
  id INTEGER PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id),
  kind TEXT NOT NULL CHECK (kind IN ('temple','mission')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  pdf_file TEXT,
  pdf_name TEXT,
  created_by INTEGER REFERENCES members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX plans_ward_kind ON plans(ward_id, kind, id);

CREATE TABLE lessons (
  id INTEGER PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id),
  date TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'talk' CHECK (kind IN ('talk','general_conference','stake_conference')),
  title TEXT NOT NULL DEFAULT '',
  speaker TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  teacher_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (ward_id, date)
);

CREATE TABLE lesson_volunteers (
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (lesson_id, member_id)
);

CREATE TABLE comments (
  id INTEGER PRIMARY KEY,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by INTEGER REFERENCES members(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX comments_lesson ON comments(lesson_id, status);

CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  presidency_only INTEGER NOT NULL DEFAULT 0,
  rsvp_enabled INTEGER NOT NULL DEFAULT 0,
  reminder_minutes INTEGER,
  created_by INTEGER REFERENCES members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX events_ward_start ON events(ward_id, starts_at);

CREATE TABLE event_rsvps (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('yes','no','maybe')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (event_id, member_id)
);

CREATE TABLE event_requests (
  id INTEGER PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id),
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  decision_note TEXT,
  decided_by INTEGER REFERENCES members(id),
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE visits (
  id INTEGER PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id),
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('home','church','phone','text')),
  notes TEXT NOT NULL DEFAULT '',
  follow_up INTEGER NOT NULL DEFAULT 0,
  follow_up_done INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX visits_member ON visits(member_id, date);

CREATE TABLE visit_visitors (
  visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (visit_id, member_id)
);

CREATE TABLE groups (
  id INTEGER PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE group_members (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, member_id)
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id),
  sender_id INTEGER REFERENCES members(id),
  audience TEXT NOT NULL,
  audience_label TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  push_count INTEGER NOT NULL DEFAULT 0,
  email_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Dedupe key for scheduled notifications so each one is sent once.
CREATE TABLE sent_notifications (
  key TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE signups (
  id INTEGER PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  date TEXT,
  closed INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE signup_slots (
  id INTEGER PRIMARY KEY,
  signup_id INTEGER NOT NULL REFERENCES signups(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE signup_entries (
  slot_id INTEGER NOT NULL REFERENCES signup_slots(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (slot_id, member_id)
);

CREATE TABLE todos (
  id INTEGER PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id),
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  assignee_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
  due_date TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  created_by INTEGER REFERENCES members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`,
  },
  {
    // Privacy redesign: the app no longer stores addresses or phone numbers,
    // and members join themselves (optionally with a ward join code).
    id: 2,
    sql: `
ALTER TABLE members DROP COLUMN phone;
ALTER TABLE members DROP COLUMN address;
ALTER TABLE wards ADD COLUMN join_code TEXT;
CREATE UNIQUE INDEX wards_join_code ON wards(join_code COLLATE NOCASE) WHERE join_code IS NOT NULL;
`,
  },
  {
    // Notes the assigned teacher writes for the quorum to read before Sunday.
    // Members see published_body; edits wait in body until an admin approves.
    id: 3,
    sql: `
CREATE TABLE lesson_notes (
  lesson_id INTEGER PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  published_body TEXT,
  published_at TEXT,
  notified INTEGER NOT NULL DEFAULT 0,
  review_note TEXT,
  reviewed_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`,
  },
  {
    // Members can use a phone number and/or an email, and choose how the app
    // contacts them when push notifications aren't on.
    id: 4,
    sql: `
ALTER TABLE members ADD COLUMN phone TEXT;
ALTER TABLE members ADD COLUMN contact_pref TEXT NOT NULL DEFAULT 'email' CHECK (contact_pref IN ('text','email','both','none'));
CREATE UNIQUE INDEX members_ward_phone ON members(ward_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX members_phone ON members(phone);
ALTER TABLE wards ADD COLUMN sms_monthly_limit INTEGER NOT NULL DEFAULT 500;
ALTER TABLE messages ADD COLUMN text_count INTEGER NOT NULL DEFAULT 0;

-- A phone number or email a member is adding, waiting for its confirmation code.
CREATE TABLE contact_verifications (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('phone','email')),
  value TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Counts texts for the monthly limit. No phone numbers or message text kept.
CREATE TABLE sms_log (
  id INTEGER PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('code','notice')),
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX sms_log_ward_time ON sms_log(ward_id, sent_at);
`,
  },
  {
    // Members can ask the presidency for a visit. Seen by the presidency only.
    id: 5,
    sql: `
CREATE TABLE visit_requests (
  id INTEGER PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('home','talk','help')),
  best_times TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','scheduled','done','closed','cancelled')),
  reply TEXT NOT NULL DEFAULT '',
  handled_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX visit_requests_ward ON visit_requests(ward_id, status);
CREATE INDEX visit_requests_member ON visit_requests(member_id);
`,
  },
  {
    // Members can see the messages they were sent and reply to the presidency,
    // in the app or by texting back.
    id: 6,
    sql: `
ALTER TABLE messages ADD COLUMN link TEXT NOT NULL DEFAULT '/';
CREATE TABLE message_recipients (
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, member_id)
);
CREATE INDEX message_recipients_member ON message_recipients(member_id);

-- One conversation per member with the presidency. 'in' = from the member, 'out' = from the presidency.
CREATE TABLE member_messages (
  id INTEGER PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  author_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
  message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  via TEXT NOT NULL DEFAULT 'app' CHECK (via IN ('app','text')),
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX member_messages_member ON member_messages(member_id, created_at);
CREATE INDEX member_messages_ward ON member_messages(ward_id, direction, read_at);

-- Texts members send back count toward the monthly limit too.
CREATE TABLE sms_log_new (
  id INTEGER PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('code','notice','reply')),
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO sms_log_new SELECT id, ward_id, kind, sent_at FROM sms_log;
DROP TABLE sms_log;
ALTER TABLE sms_log_new RENAME TO sms_log;
CREATE INDEX sms_log_ward_time ON sms_log(ward_id, sent_at);
`,
  },
  {
    // The presidency can add members by name and phone or email. Texts other than
    // sign-in codes need the member's own consent, given when they join or on the
    // welcome screen at their first sign-in.
    id: 7,
    sql: `
ALTER TABLE members ADD COLUMN sms_consent_at TEXT;
ALTER TABLE members ADD COLUMN welcomed_at TEXT;
-- Everyone so far joined themselves (agreeing on the join form) or has signed in.
UPDATE members SET welcomed_at = datetime('now') WHERE source IN ('request','setup') OR last_login_at IS NOT NULL;
UPDATE members SET sms_consent_at = updated_at WHERE phone IS NOT NULL AND (source IN ('request','setup') OR last_login_at IS NOT NULL);
`,
  },
  {
    // Members can choose to get every notification by email and/or text as well
    // as push. contact_pref stays the backup for when push doesn't reach them.
    id: 8,
    sql: `
ALTER TABLE members ADD COLUMN always_email INTEGER NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN always_text INTEGER NOT NULL DEFAULT 0;
`,
  },
  {
    // Members can write to the whole presidency or privately to one presidency
    // member (e.g. the president). Private messages are deleted with that
    // person's account rather than ever becoming visible to the others.
    id: 9,
    sql: `
ALTER TABLE member_messages ADD COLUMN recipient_id INTEGER REFERENCES members(id) ON DELETE CASCADE;
CREATE INDEX member_messages_thread ON member_messages(member_id, recipient_id);
ALTER TABLE members ADD COLUMN calling TEXT;
`,
  },
  {
    // Visits the presidency has planned (from a member's request or on their
    // own). Once a planned visit happens it's recorded in visits as usual.
    id: 10,
    sql: `
CREATE TABLE planned_visits (
  id INTEGER PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  time TEXT,
  type TEXT NOT NULL DEFAULT 'home' CHECK (type IN ('home','church','phone','text')),
  note TEXT NOT NULL DEFAULT '',
  request_id INTEGER REFERENCES visit_requests(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX planned_visits_ward ON planned_visits(ward_id, date);
CREATE TABLE planned_visit_visitors (
  planned_id INTEGER NOT NULL REFERENCES planned_visits(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (planned_id, member_id)
);
`,
  },
  {
    // An assigned teacher can say they can't teach, with an optional reason
    // for the presidency. Removed 30 days after the lesson, like volunteers.
    id: 11,
    sql: `
CREATE TABLE lesson_declines (
  id INTEGER PRIMARY KEY,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX lesson_declines_lesson ON lesson_declines(lesson_id);
`,
  },
  {
    // When the assigned teacher confirmed they're still teaching (cleared when
    // the teacher changes).
    id: 12,
    sql: `ALTER TABLE lessons ADD COLUMN teacher_confirmed_at TEXT;`,
  },
  {
    // Each member's private calendar subscription link includes this number;
    // "Reset my link" bumps it so an old (shared) link stops working.
    id: 13,
    sql: `ALTER TABLE members ADD COLUMN feed_version INTEGER NOT NULL DEFAULT 0;`,
  },
  {
    // Reminders (minutes before, comma-separated) the member wants on events
    // in their subscribed calendar and "Add to calendar" files.
    id: 14,
    sql: `ALTER TABLE members ADD COLUMN calendar_alerts TEXT NOT NULL DEFAULT '60';`,
  },
  {
    // Repeating events: a series holds the pattern and the details; each date
    // is a normal event (series_id) so RSVPs, reminders and calendars just work.
    id: 15,
    sql: `
CREATE TABLE event_series (
  id INTEGER PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL CHECK (pattern IN ('weekly','biweekly','monthly_nth','monthly_last','monthly_day')),
  start_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  until_date TEXT,
  max_count INTEGER,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  presidency_only INTEGER NOT NULL DEFAULT 0,
  rsvp_enabled INTEGER NOT NULL DEFAULT 0,
  reminder_minutes INTEGER,
  generated_until TEXT,
  created_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE events ADD COLUMN series_id INTEGER REFERENCES event_series(id) ON DELETE SET NULL;
CREATE INDEX events_series ON events(series_id, starts_at);
`,
  },
  {
    // The presidency can ask a member to teach a lesson; the member accepts
    // (and is assigned) or declines with an optional reason.
    id: 16,
    sql: `
CREATE TABLE teaching_requests (
  id INTEGER PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  reason TEXT NOT NULL DEFAULT '',
  asked_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT
);
CREATE INDEX teaching_requests_lesson ON teaching_requests(lesson_id);
CREATE INDEX teaching_requests_member ON teaching_requests(member_id, status);
`,
  },
  {
    // A planned visit can be sent to the member as a personal invitation they
    // answer: yes, another time (with their suggestion), or not right now.
    id: 17,
    sql: `
ALTER TABLE planned_visits ADD COLUMN invite_status TEXT CHECK (invite_status IN ('pending','accepted','new_time','declined'));
ALTER TABLE planned_visits ADD COLUMN invite_message TEXT NOT NULL DEFAULT '';
ALTER TABLE planned_visits ADD COLUMN member_reply TEXT NOT NULL DEFAULT '';
ALTER TABLE planned_visits ADD COLUMN responded_at TEXT;
`,
  },
  {
    // Every notification sent to a member, so the full text can be read in the
    // app (More > Notifications). Deleted after 30 days.
    id: 18,
    sql: `
CREATE TABLE notification_log (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '/',
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX notification_log_member ON notification_log(member_id, created_at);
`,
  },
  {
    // Clean up notes left behind by teachers who are no longer teaching the
    // lesson: anyone who said they couldn't teach it, and members (not leaders,
    // who may write notes for a lesson) who aren't its teacher any more.
    id: 19,
    sql: `
DELETE FROM lesson_notes WHERE author_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM lessons l WHERE l.id = lesson_notes.lesson_id AND (l.teacher_id IS NULL OR l.teacher_id != lesson_notes.author_id)
) AND (
  EXISTS (SELECT 1 FROM lesson_declines d WHERE d.lesson_id = lesson_notes.lesson_id AND d.member_id = lesson_notes.author_id)
  OR author_id IN (SELECT id FROM members WHERE role = 'member')
);
`,
  },
  {
    // Wards and organizations. Until now each "ward" row was really one elders
    // quorum, so those rows become organizations (keeping their ids, so every
    // lesson, event and message stays put) inside a real ward. Each ward also
    // gets a ward-wide organization led by the bishopric. A person now has one
    // account and belongs to wards and organizations through memberships, with
    // their role and calling kept per organization.
    id: 20,
    fkOff: true,
    sql: `
DROP INDEX IF EXISTS wards_join_code;
ALTER TABLE wards RENAME TO orgs;

ALTER TABLE plans RENAME COLUMN ward_id TO org_id;
ALTER TABLE lessons RENAME COLUMN ward_id TO org_id;
ALTER TABLE events RENAME COLUMN ward_id TO org_id;
ALTER TABLE event_requests RENAME COLUMN ward_id TO org_id;
ALTER TABLE visits RENAME COLUMN ward_id TO org_id;
ALTER TABLE groups RENAME COLUMN ward_id TO org_id;
ALTER TABLE messages RENAME COLUMN ward_id TO org_id;
ALTER TABLE signups RENAME COLUMN ward_id TO org_id;
ALTER TABLE todos RENAME COLUMN ward_id TO org_id;
ALTER TABLE sms_log RENAME COLUMN ward_id TO org_id;
ALTER TABLE visit_requests RENAME COLUMN ward_id TO org_id;
ALTER TABLE member_messages RENAME COLUMN ward_id TO org_id;
ALTER TABLE planned_visits RENAME COLUMN ward_id TO org_id;
ALTER TABLE event_series RENAME COLUMN ward_id TO org_id;
ALTER TABLE teaching_requests RENAME COLUMN ward_id TO org_id;

CREATE TABLE wards (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Boise',
  join_code TEXT,
  sms_monthly_limit INTEGER NOT NULL DEFAULT 500,
  created_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX wards_join_code ON wards(join_code COLLATE NOCASE) WHERE join_code IS NOT NULL;
INSERT INTO wards (id, name, timezone, join_code, sms_monthly_limit, created_at)
  SELECT id,
    CASE WHEN name LIKE '% Elders Quorum' THEN substr(name, 1, length(name) - 14) ELSE name END,
    timezone, COALESCE(join_code, upper(hex(randomblob(3)))), sms_monthly_limit, created_at
  FROM orgs;

ALTER TABLE orgs ADD COLUMN ward_id INTEGER REFERENCES wards(id) ON DELETE CASCADE;
-- 'ward': the ward-wide organization (bishopric); 'group': any other.
ALTER TABLE orgs ADD COLUMN kind TEXT NOT NULL DEFAULT 'group' CHECK (kind IN ('ward','group'));
-- Features this organization doesn't use, comma-separated (e.g. 'visits,plans').
ALTER TABLE orgs ADD COLUMN hidden_features TEXT NOT NULL DEFAULT '';
UPDATE orgs SET ward_id = id, name = 'Elders Quorum';
ALTER TABLE orgs DROP COLUMN timezone;
ALTER TABLE orgs DROP COLUMN join_code;
ALTER TABLE orgs DROP COLUMN sms_monthly_limit;
INSERT INTO orgs (name, ward_id, kind, hidden_features) SELECT 'Ward', id, 'ward', 'lessons,plans' FROM wards;
CREATE INDEX orgs_ward ON orgs(ward_id);

CREATE TABLE ward_members (
  ward_id INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (ward_id, member_id)
);
CREATE INDEX ward_members_member ON ward_members(member_id);

-- A person's place in an organization: their role there, their calling, whether
-- they officially belong, and whether they get its notifications.
CREATE TABLE org_members (
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin','presidency')),
  calling TEXT,
  official INTEGER NOT NULL DEFAULT 1,
  notify INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (org_id, member_id)
);
CREATE INDEX org_members_member ON org_members(member_id);

INSERT INTO ward_members (ward_id, member_id) SELECT ward_id, id FROM members;
INSERT INTO org_members (org_id, member_id, role, calling) SELECT ward_id, id, role, calling FROM members;
INSERT INTO org_members (org_id, member_id, role)
  SELECT o.id, m.id, CASE WHEN m.is_site_owner = 1 THEN 'presidency' ELSE 'member' END
  FROM members m JOIN orgs o ON o.ward_id = m.ward_id AND o.kind = 'ward';

-- Accounts no longer belong to one ward, and roles moved to org_members.
CREATE TABLE members_new (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  contact_pref TEXT NOT NULL DEFAULT 'email' CHECK (contact_pref IN ('text','email','both','none')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','inactive','declined')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('import','manual','request','setup')),
  request_note TEXT,
  is_site_owner INTEGER NOT NULL DEFAULT 0,
  theme TEXT NOT NULL DEFAULT 'system',
  last_login_at TEXT,
  sms_consent_at TEXT,
  welcomed_at TEXT,
  always_email INTEGER NOT NULL DEFAULT 0,
  always_text INTEGER NOT NULL DEFAULT 0,
  feed_version INTEGER NOT NULL DEFAULT 0,
  calendar_alerts TEXT NOT NULL DEFAULT '60',
  -- Organization the member last got a text about, so a texted reply reaches it.
  last_text_org_id INTEGER REFERENCES orgs(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO members_new (id, name, display_name, email, phone, contact_pref, status, source, request_note, is_site_owner, theme, last_login_at,
    sms_consent_at, welcomed_at, always_email, always_text, feed_version, calendar_alerts, created_at, updated_at)
  SELECT id, name, display_name, email, phone, contact_pref, status, source, request_note, is_site_owner, theme, last_login_at,
    sms_consent_at, welcomed_at, always_email, always_text, feed_version, calendar_alerts, created_at, updated_at
  FROM members;
DROP TABLE members;
ALTER TABLE members_new RENAME TO members;
CREATE INDEX members_email ON members(email COLLATE NOCASE);
CREATE INDEX members_phone ON members(phone);
`,
  },
  {
    // Anyone can start a ward. Texting costs the site owner and runs under one
    // texting registration, so wards someone else starts have it off until the
    // site owner turns it on. Wards that already exist keep it on.
    id: 21,
    sql: `ALTER TABLE wards ADD COLUMN texting_enabled INTEGER NOT NULL DEFAULT 1;`,
  },
  {
    // Phones running the My Ward Link app get notifications through Expo's push
    // service (one token per phone), alongside browser push subscriptions.
    id: 22,
    sql: `
CREATE TABLE native_push_tokens (
  token TEXT PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX native_push_tokens_member ON native_push_tokens(member_id);
`,
  },
  {
    // Plans belong to the ward. Each is for the whole ward (no ward_plan_orgs
    // rows) or for chosen organizations (e.g. Young Men and Young Women). The
    // temple and mission plans each ward had become its first two ward plans,
    // keeping every version; plans.org_id now just says where an edit was made.
    id: 23,
    sql: `
CREATE TABLE ward_plans (
  id INTEGER PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  legacy_kind TEXT,
  created_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ward_plans_ward ON ward_plans(ward_id);
CREATE TABLE ward_plan_orgs (
  plan_id INTEGER NOT NULL REFERENCES ward_plans(id) ON DELETE CASCADE,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, org_id)
);
INSERT INTO ward_plans (ward_id, name, legacy_kind) SELECT id, 'Temple & Family History Plan', 'temple' FROM wards;
INSERT INTO ward_plans (ward_id, name, legacy_kind) SELECT id, 'Ward Mission Plan', 'mission' FROM wards;

CREATE TABLE plan_versions (
  id INTEGER PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES ward_plans(id) ON DELETE CASCADE,
  org_id INTEGER REFERENCES orgs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  pdf_file TEXT,
  pdf_name TEXT,
  created_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX plan_versions_plan ON plan_versions(plan_id, id);
INSERT INTO plan_versions (id, plan_id, org_id, title, body, pdf_file, pdf_name, created_by, created_at)
  SELECT p.id, wp.id, p.org_id, p.title, p.body, p.pdf_file, p.pdf_name, p.created_by, p.created_at
  FROM plans p JOIN orgs o ON o.id = p.org_id JOIN ward_plans wp ON wp.ward_id = o.ward_id AND wp.legacy_kind = p.kind;
DROP TABLE plans;

-- Plans show in every organization now.
UPDATE orgs SET hidden_features = trim(replace(replace(',' || hidden_features || ',', ',plans,', ','), ',,', ','), ',');
`,
  },
  {
    // The organization a member last switched to, on any device, so their
    // phone and computer show the same one.
    id: 24,
    sql: `
ALTER TABLE members ADD COLUMN last_org_id INTEGER REFERENCES orgs(id) ON DELETE SET NULL;
ALTER TABLE members ADD COLUMN last_org_at INTEGER NOT NULL DEFAULT 0;
`,
  },
  {
    // Who can see a message group and send to it: the presidency, admins,
    // and/or the people in the group. Existing groups keep working as before.
    id: 25,
    sql: `
ALTER TABLE groups ADD COLUMN send_presidency INTEGER NOT NULL DEFAULT 1;
ALTER TABLE groups ADD COLUMN send_admins INTEGER NOT NULL DEFAULT 1;
ALTER TABLE groups ADD COLUMN send_members INTEGER NOT NULL DEFAULT 0;
`,
  },
  {
    // Organizations can be turned off. Every ward gets the standard ones;
    // existing wards get the ones they're missing, turned off.
    id: 26,
    sql: `
ALTER TABLE orgs ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
INSERT INTO orgs (ward_id, name, kind, active)
  SELECT w.id, s.name, 'group', 0 FROM wards w
  CROSS JOIN (SELECT 'Elders Quorum' AS name UNION ALL SELECT 'Relief Society' UNION ALL SELECT 'Young Men'
              UNION ALL SELECT 'Young Women' UNION ALL SELECT 'Primary' UNION ALL SELECT 'Sunday School') s
  WHERE NOT EXISTS (SELECT 1 FROM orgs o WHERE o.ward_id = w.id AND o.kind = 'group' AND lower(o.name) = lower(s.name));
`,
  },
  {
    // Admin is for leadership only. Admins with a calling (e.g. a secretary)
    // join the leadership; the rest become members. Groups admins could send
    // to stay available to the leadership.
    id: 27,
    sql: `
UPDATE org_members SET role = CASE WHEN calling IS NOT NULL THEN 'presidency' ELSE 'member' END WHERE role = 'admin';
UPDATE groups SET send_presidency = 1 WHERE send_admins = 1;
UPDATE groups SET send_admins = 0;
`,
  },
  {
    // Plans are built as a page of blocks (headings, text, pictures, PDFs).
    // plan_files records which ward each uploaded file belongs to.
    id: 28,
    sql: `
ALTER TABLE plan_versions ADD COLUMN blocks TEXT;
CREATE TABLE plan_files (
  name TEXT PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  uploaded_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`,
  },
  {
    // A leader who texts back after being texted a member's message answers
    // that member. Set when that text is sent; cleared by any other text.
    id: 29,
    sql: `
ALTER TABLE members ADD COLUMN text_reply_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL;
ALTER TABLE members ADD COLUMN text_reply_private INTEGER NOT NULL DEFAULT 0;
`,
  },
  {
    // What happened to each incoming text, for the site owner (kept 30 days; no message text).
    id: 30,
    sql: `
CREATE TABLE sms_inbound_log (
  id INTEGER PRIMARY KEY,
  member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
  result TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`,
  },
  {
    // Texts carry a short link (/n/<id>) that opens the notification in its organization.
    id: 31,
    sql: `ALTER TABLE notification_log ADD COLUMN org_id INTEGER REFERENCES orgs(id) ON DELETE SET NULL;`,
  },
  {
    // A leader's texted reply held while the app asks who it's for (two people wrote at once).
    id: 32,
    sql: `
CREATE TABLE sms_pending (
  leader_id INTEGER PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  options TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`,
  },
  {
    // Each leader has their own read/unread for members' messages, like email. (read_at on
    // the message stays "seen by a leader", for the member's "Seen".) Messages already read
    // count as read for every leader who could see them.
    id: 33,
    sql: `
CREATE TABLE message_reads (
  message_id INTEGER NOT NULL REFERENCES member_messages(id) ON DELETE CASCADE,
  viewer_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, viewer_id)
);
INSERT OR IGNORE INTO message_reads (message_id, viewer_id)
  SELECT mm.id, om.member_id FROM member_messages mm
  JOIN org_members om ON om.org_id = mm.org_id AND om.role = 'presidency'
  WHERE mm.direction = 'in' AND mm.read_at IS NOT NULL AND (mm.recipient_id IS NULL OR mm.recipient_id = om.member_id);
`,
  },
  {
    // A flyer (PDF or picture) on a service opportunity.
    id: 34,
    sql: `
ALTER TABLE signups ADD COLUMN flyer_file TEXT;
ALTER TABLE signups ADD COLUMN flyer_name TEXT;
`,
  },
  {
    // Events: a flyer and a second reminder (also on repeating-event series, so every
    // date gets them). Service opportunities: two reminders, set per opportunity
    // (days before; NULL = none), a week and a day before by default.
    id: 35,
    sql: `
ALTER TABLE events ADD COLUMN reminder2_minutes INTEGER;
ALTER TABLE events ADD COLUMN flyer_file TEXT;
ALTER TABLE events ADD COLUMN flyer_name TEXT;
ALTER TABLE event_series ADD COLUMN reminder2_minutes INTEGER;
ALTER TABLE event_series ADD COLUMN flyer_file TEXT;
ALTER TABLE event_series ADD COLUMN flyer_name TEXT;
ALTER TABLE signups ADD COLUMN reminder1_days INTEGER DEFAULT 7;
ALTER TABLE signups ADD COLUMN reminder2_days INTEGER DEFAULT 1;
`,
  },
  {
    // Members' inbox: which announcements they've opened. Everything already sent counts as read.
    id: 36,
    sql: `
ALTER TABLE message_recipients ADD COLUMN read_at TEXT;
UPDATE message_recipients SET read_at = datetime('now');
`,
  },
  {
    // The last text was to them as a member (a visit invitation, a leader's personal
    // message): a texted reply goes to the presidency even if they're a leader too.
    id: 37,
    sql: `ALTER TABLE members ADD COLUMN text_as_member INTEGER NOT NULL DEFAULT 0;`,
  },
  {
    // Counts recent attempts (sign-in codes asked for, wrong codes, join codes tried)
    // per device and across the site, so they can't be guessed or abused at scale.
    id: 38,
    sql: `
CREATE TABLE rate_hits (
  key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX rate_hits_key ON rate_hits(key, created_at);
`,
  },
  {
    // Starting a new ward is a request the site owner approves (after checking it's real).
    id: 39,
    sql: `
CREATE TABLE ward_requests (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  contact_kind TEXT NOT NULL CHECK (contact_kind IN ('email','phone')),
  ward_name TEXT NOT NULL,
  stake TEXT NOT NULL DEFAULT '',
  calling TEXT,
  timezone TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  ward_id INTEGER REFERENCES wards(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT
);
`,
  },
  {
    // When the account's email was last proven theirs (a code or link sent to it was used).
    // The site owner's email (OWNER_EMAIL) only counts once it's proven. Accounts that
    // have signed in before are trusted as they are.
    id: 40,
    sql: `
ALTER TABLE members ADD COLUMN email_verified_at TEXT;
UPDATE members SET email_verified_at = datetime('now') WHERE email IS NOT NULL AND last_login_at IS NOT NULL;
`,
  },
  {
    // A ward someone starts is set up right away but stays "under review" (nothing
    // can be done in it, and nothing is sent) until the site owner approves it.
    // Visits: whether the member was told about it (they get its reminder too).
    id: 41,
    sql: `
ALTER TABLE wards ADD COLUMN pending INTEGER NOT NULL DEFAULT 0;
ALTER TABLE wards ADD COLUMN stake TEXT NOT NULL DEFAULT '';
ALTER TABLE wards ADD COLUMN request_note TEXT NOT NULL DEFAULT '';
ALTER TABLE planned_visits ADD COLUMN member_told INTEGER NOT NULL DEFAULT 0;
UPDATE planned_visits SET member_told = 1 WHERE invite_status IS NOT NULL;
`,
  },
  {
    // An organization's own wording for messages the app sends on its own
    // (Admin -> Message wording). Missing rows use the app's wording.
    id: 42,
    sql: `
CREATE TABLE message_templates (
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  updated_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (org_id, key)
);
`,
  },
  {
    // A flyer (PDF or picture) on a message sent to a group.
    id: 43,
    sql: `
ALTER TABLE messages ADD COLUMN flyer_file TEXT;
ALTER TABLE messages ADD COLUMN flyer_name TEXT;
`,
  },
  {
    // Public links (and QR codes): one picture/PDF, or one service opportunity that
    // people without an account can sign up for. Guests who sign up that way.
    id: 44,
    sql: `
CREATE TABLE public_shares (
  token TEXT PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('file','signup')),
  file TEXT,
  signup_id INTEGER REFERENCES signups(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX public_shares_org ON public_shares(org_id);
CREATE TABLE signup_guests (
  id INTEGER PRIMARY KEY,
  slot_id INTEGER NOT NULL REFERENCES signup_slots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  contact_kind TEXT NOT NULL CHECK (contact_kind IN ('email','phone')),
  note TEXT NOT NULL DEFAULT '',
  -- Texts only with this: when they ticked the box, and the words they agreed to.
  sms_consent_at TEXT,
  consent_text TEXT,
  code_hash TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  confirmed_at TEXT,
  cancel_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX signup_guests_slot ON signup_guests(slot_id);
`,
  },
  {
    // A whole plan page can be shared publicly too.
    id: 45,
    sql: `
CREATE TABLE public_shares_new (
  token TEXT PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('file','signup','plan')),
  file TEXT,
  signup_id INTEGER REFERENCES signups(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES ward_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO public_shares_new (token, org_id, kind, file, signup_id, title, caption, created_by, created_at)
  SELECT token, org_id, kind, file, signup_id, title, caption, created_by, created_at FROM public_shares;
DROP TABLE public_shares;
ALTER TABLE public_shares_new RENAME TO public_shares;
CREATE INDEX public_shares_org ON public_shares(org_id);
`,
  },
  {
    // A plan's icon: one of the drawn ones or an emoji (icon), or an uploaded picture (icon_file).
    id: 46,
    sql: `
ALTER TABLE ward_plans ADD COLUMN icon TEXT;
ALTER TABLE ward_plans ADD COLUMN icon_file TEXT;
`,
  },
  {
    // Come, Follow Me: the weekly schedule (for the whole site, loaded by the site owner),
    // and which Sunday School lessons were filled from it (and not changed by hand since).
    id: 47,
    sql: `
CREATE TABLE cfm_weeks (
  sunday TEXT PRIMARY KEY,
  start TEXT NOT NULL,
  reading TEXT NOT NULL,
  theme TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT ''
);
ALTER TABLE lessons ADD COLUMN cfm_auto INTEGER NOT NULL DEFAULT 0;
`,
  },
  {
    // A demo ward with made-up people, for the app stores' reviewers.
    id: 48,
    sql: `ALTER TABLE wards ADD COLUMN demo INTEGER NOT NULL DEFAULT 0;`,
  },
  {
    // Other organizations invited to an event: "ward" (everyone in the ward) or
    // a list of organization ids ("5,7"). They see it, get its reminders and can RSVP.
    id: 49,
    sql: `
ALTER TABLE events ADD COLUMN invited TEXT NOT NULL DEFAULT '';
ALTER TABLE event_series ADD COLUMN invited TEXT NOT NULL DEFAULT '';
`,
  },
  {
    // Who an event or service opportunity was last announced to ("everyone",
    // "group:3"...), so an update can go to the same people.
    id: 50,
    sql: `
ALTER TABLE events ADD COLUMN announced_to TEXT;
ALTER TABLE signups ADD COLUMN announced_to TEXT;
`,
  },
  {
    // "Everyone" on an event used to include the organizations it invited; that is
    // its own choice now ("invited"), so earlier sends keep meaning the same people.
    id: 51,
    sql: `UPDATE events SET announced_to = announced_to || ',invited'
      WHERE invited <> '' AND instr(',' || announced_to || ',', ',everyone,') > 0 AND instr(',' || announced_to || ',', ',invited,') = 0;`,
  },
  {
    // A member's own reminders for lessons, events and service, instead of the ones
    // their leaders scheduled ('custom'), or none ('off'). No row: as scheduled.
    // Each reminder: when ("m:60" = an hour before an event; "d:1@08:00" = the day
    // before at 8 AM) and how (an app notification or a text).
    id: 52,
    sql: `
CREATE TABLE reminder_prefs (
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('lessons','events','service')),
  mode TEXT NOT NULL CHECK (mode IN ('custom','off')),
  PRIMARY KEY (member_id, kind)
);
CREATE TABLE member_reminders (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('lessons','events','service')),
  when_key TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('push','text'))
);
CREATE INDEX member_reminders_member ON member_reminders(member_id, kind);
`,
  },
  {
    // Making sure a member's message always reaches someone:
    // - the ward's backup person gets replies an organization can't receive (turned off,
    //   or nobody in its presidency) and passes them on;
    // - a message can be forwarded to another organization or leader (note says so);
    // - which organizations texted a member lately, to ask which one a reply is for;
    // - a texted reply held while asking.
    id: 53,
    sql: `
ALTER TABLE wards ADD COLUMN reply_backup_id INTEGER REFERENCES members(id) ON DELETE SET NULL;
ALTER TABLE member_messages ADD COLUMN needs_home INTEGER NOT NULL DEFAULT 0;
ALTER TABLE member_messages ADD COLUMN note TEXT;
CREATE TABLE member_text_orgs (
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (member_id, org_id)
);
CREATE TABLE sms_member_pending (
  member_id INTEGER PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  options TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`,
  },
  {
    // Presidency planning: meetings with notes, an agenda that collects items for the
    // next meeting (from messages too), and assignments to anyone in the organization
    // with a status and progress notes. Meetings and finished assignments carry a
    // review date: the handbook asks to keep notes only as long as they're needed.
    id: 54,
    sql: `
CREATE TABLE meetings (
  id INTEGER PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  attendees TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  held_at TEXT,
  review_at TEXT,
  created_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX meetings_org ON meetings(org_id, date);
CREATE TABLE agenda_items (
  id INTEGER PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  link TEXT,
  discussed INTEGER NOT NULL DEFAULT 0,
  review_at TEXT,
  added_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX agenda_items_org ON agenda_items(org_id, meeting_id);
ALTER TABLE todos ADD COLUMN status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','progress','done'));
UPDATE todos SET status = 'done' WHERE done = 1;
ALTER TABLE todos ADD COLUMN meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL;
ALTER TABLE todos ADD COLUMN review_at TEXT;
UPDATE todos SET review_at = date(coalesce(done_at, created_at), '+3 months') WHERE done = 1;
CREATE TABLE todo_notes (
  id INTEGER PRIMARY KEY,
  todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  private INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX todo_notes_todo ON todo_notes(todo_id);
`,
  },
  {
    // Regular teachers: one person for each 1st-4th Sunday of the month (someone can
    // have several, e.g. 2nd and 4th; 5th Sundays have none). Lessons they're put on
    // are marked, and a lesson is filled only once (a teacher taken off stays off).
    id: 55,
    sql: `
CREATE TABLE regular_teachers (
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  week INTEGER NOT NULL CHECK (week BETWEEN 1 AND 4),
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (org_id, week)
);
ALTER TABLE lessons ADD COLUMN teacher_auto INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lessons ADD COLUMN regular_done INTEGER NOT NULL DEFAULT 0;
`,
  },
  {
    // A presidency's (or bishopric's) video meeting link (Zoom, Google Meet, Teams), to
    // start a meeting from the app and let the others join.
    id: 56,
    sql: `ALTER TABLE orgs ADD COLUMN video_link TEXT;`,
  },
  {
    // Presidency meetings are scheduled (a time, and a presidency-only event on the
    // calendar), and agenda items carry their own notes from the meeting.
    id: 57,
    sql: `
ALTER TABLE meetings ADD COLUMN time TEXT;
ALTER TABLE meetings ADD COLUMN event_id INTEGER REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE agenda_items ADD COLUMN notes TEXT NOT NULL DEFAULT '';
`,
  },
  {
    // Members' own reminders can come by email too (and by more than one way at once:
    // a row per way). Service opportunities can have a start time, and members' own
    // service reminders use the same timings as events (before the start).
    id: 58,
    sql: `
ALTER TABLE signups ADD COLUMN time TEXT;
CREATE TABLE member_reminders_new (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('lessons','events','service')),
  when_key TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('push','text','email'))
);
INSERT INTO member_reminders_new (id, member_id, kind, when_key, channel)
  SELECT id, member_id, kind,
    CASE WHEN kind <> 'service' THEN when_key
      WHEN when_key LIKE 'd:14@%' THEN 'm:20160'
      WHEN when_key LIKE 'd:7@%' THEN 'm:10080'
      WHEN when_key LIKE 'd:3@%' OR when_key LIKE 'd:2@%' THEN 'm:2880'
      WHEN when_key LIKE 'd:1@%' THEN 'm:1440'
      ELSE 'm:120' END,
    channel
  FROM member_reminders;
DROP TABLE member_reminders;
ALTER TABLE member_reminders_new RENAME TO member_reminders;
CREATE INDEX member_reminders_member ON member_reminders(member_id, kind);
`,
  },
  {
    // Who conducts each Sunday follows the presidency's callings by month; someone
    // who can't be there asks another presidency member, who accepts or declines.
    id: 59,
    sql: `
CREATE TABLE conducting_swaps (
  id INTEGER PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  from_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT
);
CREATE INDEX conducting_swaps_org ON conducting_swaps(org_id, date);
`,
  },
  {
    // A lesson on an assigned topic (not a conference talk): a flag on a lesson.
    id: 60,
    sql: `ALTER TABLE lessons ADD COLUMN topic INTEGER NOT NULL DEFAULT 0;`,
  },
  {
    // Messages (conversations and announcements) are in Messages; the Reminders &
    // alerts list leaves them out. They're still logged, for the texted short link.
    id: 61,
    sql: `ALTER TABLE notification_log ADD COLUMN message INTEGER NOT NULL DEFAULT 0;`,
  },
];
