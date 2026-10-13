export type Role = "member" | "admin" | "presidency";
export type MemberStatus = "active" | "pending" | "inactive" | "declined";

export interface Member {
  id: number;
  ward_id: number;
  name: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  contact_pref: "text" | "email" | "both" | "none";
  role: Role;
  status: MemberStatus;
  source: string;
  request_note: string | null;
  is_site_owner: number;
  theme: "system" | "light" | "dark";
  last_login_at: string | null;
  /** When the member agreed to quorum texts (null: sign-in codes only). */
  sms_consent_at: string | null;
  /** Presidency calling, shown to members choosing who to write to. */
  calling: Calling | null;
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
}

export interface CurrentUser extends Member {
  ward: Ward;
}

export type LessonKind = "talk" | "general_conference" | "stake_conference";

export interface Lesson {
  id: number;
  ward_id: number;
  date: string;
  kind: LessonKind;
  title: string;
  speaker: string;
  url: string;
  teacher_id: number | null;
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
  ward_id: number;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  presidency_only: number;
  rsvp_enabled: number;
  reminder_minutes: number | null;
}

export type Calling = "president" | "first_counselor" | "second_counselor" | "secretary" | "assistant_secretary" | "stake_high_council";

export const CALLING_LABELS: Record<Calling, string> = {
  president: "Elders Quorum President",
  first_counselor: "First Counselor",
  second_counselor: "Second Counselor",
  secretary: "Secretary",
  assistant_secretary: "Assistant Secretary",
  stake_high_council: "Stake High Council",
};

export const ROLE_LABELS: Record<Role, string> = {
  member: "Member",
  admin: "Admin",
  presidency: "Presidency",
};

export const LESSON_KIND_LABELS: Record<LessonKind, string> = {
  talk: "Lesson",
  general_conference: "General Conference",
  stake_conference: "Stake Conference",
};
