// Schema migrations. Append new entries; never edit one that has shipped.
export const migrations: { id: number; sql: string }[] = [
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
];
