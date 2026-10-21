export type Role = "member" | "admin" | "presidency";
export type MemberStatus = "active" | "pending" | "inactive" | "declined";

/** A person's account. Wards and organizations they belong to are in ward_members / org_members. */
export interface Member {
  id: number;
  name: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  contact_pref: "text" | "email" | "both" | "none";
  status: MemberStatus;
  source: string;
  request_note: string | null;
  is_site_owner: number;
  /** When a code or link sent to their email was last used (proves the email is theirs). */
  email_verified_at?: string | null;
  theme: "system" | "light" | "dark";
  last_login_at: string | null;
  /** When the member agreed to quorum texts (null: sign-in codes only). */
  sms_consent_at: string | null;
  /** Organization the member last got a text about (where a texted reply goes). */
  last_text_org_id: number | null;
  /** Organization the member last switched to (on any device), and when (ms). */
  last_org_id: number | null;
  last_org_at: number;
  /** Minutes-before reminders for their calendar, e.g. "1440,60" ("" for none). */
  calendar_alerts: string;
  /** Bumped to cancel the member's old calendar subscription link. */
  feed_version: number;
  /** Send every notification by email / text too, not just when push misses. */
  always_email: number;
  always_text: number;
  /** When the member saw the welcome screen and agreed to what the app keeps. */
  welcomed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Ward {
  id: number;
  name: string;
  timezone: string;
  join_code: string | null;
  sms_monthly_limit: number;
  created_by: number | null;
  /** Reminder and message texts allowed (the site owner turns this on for wards others start). */
  texting_enabled: number;
  /** 1 while the site owner hasn't approved it yet (it's "under review"). */
  pending: number;
  stake: string;
  request_note: string;
  /** Gets members' messages an organization can't receive, and passes them on. */
  reply_backup_id: number | null;
}

/** Features an organization can hide when it doesn't use them. */
export const FEATURES = {
  lessons: "Lessons and teachers",
  signups: "Service opportunities",
  visits: "Visits and visit requests",
  todos: "Assignments and presidency meetings",
} as const;
export type Feature = keyof typeof FEATURES;

/** An organization in a ward. Each ward has one kind 'ward' (led by the bishopric). */
export interface Org {
  id: number;
  ward_id: number;
  name: string;
  kind: "ward" | "group";
  hidden_features: string;
  /** Turned off organizations stay in Admin → Settings but are hidden everywhere else. */
  active: number;
}

/** Created with every ward; the bishopric turns off the ones the ward doesn't use. */
export const STANDARD_ORGS = ["Elders Quorum", "Relief Society", "Young Men", "Young Women", "Primary", "Sunday School"];

/** An organization in the current ward, with the user's place in it. */
export interface OrgEntry extends Org {
  label: string;
  role: Role;
  calling: Calling | null;
  /** Has an org_members row (officially belongs, gets notifications, or leads). */
  joined: boolean;
  official: boolean;
  notify: boolean;
}

/**
 * The signed-in member, seen from the organization they're looking at.
 * org_id/role/calling are for that organization; ward is its ward.
 */
export interface CurrentUser extends Member {
  ward: Ward;
  ward_id: number;
  org: Org;
  org_id: number;
  /** "Elders Quorum", or the ward's name for the ward-wide organization. */
  orgLabel: string;
  role: Role;
  calling: Calling | null;
  /** Every organization in the current ward. */
  orgs: OrgEntry[];
  /** Every ward the member belongs to. */
  wards: Ward[];
  /** Bishopric (leads the ward-wide organization) or created the ward. */
  wardLeader: boolean;
}

export type LessonKind = "talk" | "general_conference" | "stake_conference";

export interface Lesson {
  id: number;
  org_id: number;
  date: string;
  kind: LessonKind;
  title: string;
  speaker: string;
  url: string;
  teacher_id: number | null;
  teacher_confirmed_at: string | null;
  /** Filled from Come, Follow Me (Sunday School) and not changed by hand since. */
  cfm_auto: number;
}

export interface Comment {
  id: number;
  lesson_id: number;
  parent_id: number | null;
  member_id: number;
  body: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface EventRow {
  id: number;
  org_id: number;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  presidency_only: number;
  rsvp_enabled: number;
  reminder_minutes: number | null;
  reminder2_minutes: number | null;
  /** A flyer: a PDF or picture (stored name, and the name it was uploaded with). */
  flyer_file: string | null;
  flyer_name: string | null;
  series_id: number | null;
  /** Which organization's event (filled in by the calendar queries). */
  org_label?: string;
  org_kind?: Org["kind"];
  /** Other organizations invited: "ward" (the whole ward), or organization ids "5,7". */
  invited: string;
  /** Who it was last announced to ("everyone", "group:3"...), if it was. */
  announced_to?: string | null;
}

export type Calling = "bishop" | "president" | "first_counselor" | "second_counselor" | "executive_secretary" | "ward_clerk" | "secretary" | "assistant_secretary" | "stake_high_council";

/** Callings offered in each kind of organization, in order of seniority. */
export const CALLINGS: Record<Org["kind"], Calling[]> = {
  ward: ["bishop", "first_counselor", "second_counselor", "executive_secretary", "ward_clerk"],
  group: ["president", "first_counselor", "second_counselor", "secretary", "assistant_secretary", "stake_high_council"],
};

export const isCalling = (v: unknown): v is Calling => typeof v === "string" && ["bishop", ...CALLINGS.group].includes(v);

/** "Elders Quorum President", "Bishop", "First Counselor"… */
export function callingLabel(calling: Calling, org: Pick<Org, "kind" | "name">): string {
  switch (calling) {
    case "bishop":
      return "Bishop";
    case "president":
      return `${org.name} President`;
    case "first_counselor":
      return org.kind === "ward" ? "First Counselor in the Bishopric" : "First Counselor";
    case "second_counselor":
      return org.kind === "ward" ? "Second Counselor in the Bishopric" : "Second Counselor";
    case "executive_secretary":
      return "Executive Secretary";
    case "ward_clerk":
      return "Ward Clerk";
    case "secretary":
      return "Secretary";
    case "assistant_secretary":
      return "Assistant Secretary";
    case "stake_high_council":
      return "Stake High Council";
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  member: "Member",
  // Retired: admins became leaders (with a calling) or members.
  admin: "Member",
  presidency: "Presidency",
};

/** "presidency", or "bishopric" for the ward-wide organization. */
export const leadersWord = (org: Pick<Org, "kind">) => (org.kind === "ward" ? "bishopric" : "presidency");

/** "Presidency", or "Bishopric" for the ward-wide organization. */
export const roleLabel = (role: Role, org: Pick<Org, "kind">) => (role === "presidency" && org.kind === "ward" ? "Bishopric" : ROLE_LABELS[role]);

export const LESSON_KIND_LABELS: Record<LessonKind, string> = {
  talk: "Lesson",
  general_conference: "General Conference",
  stake_conference: "Stake Conference",
};
