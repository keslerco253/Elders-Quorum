// The wording of messages the app sends on its own (reminders and the like). Each
// organization can change them under Admin -> Message wording. No database here,
// so the browser can show a live preview.
//
// In a template, {name} is filled in (see each template's list), and text in
// [square brackets] is left out when something in it is blank. For example
// "[ at {location}]" disappears for an event with no location.

export interface TemplateVar {
  name: string;
  desc: string;
  sample: string;
}

export interface TemplateDef {
  key: string;
  label: string;
  /** Who gets it, and when. */
  about: string;
  /** Texts show the title too, unless the message is "personal" (just the words, signed). */
  title?: string;
  body: string;
  personal?: boolean;
  vars: TemplateVar[];
}

const v = (name: string, desc: string, sample: string): TemplateVar => ({ name, desc, sample });

export const TEMPLATE_DEFS: TemplateDef[] = [
  {
    key: "visit_reminder_member",
    label: "Visit reminder (to the member)",
    about: "To the member being visited, 3 hours before (or the evening before an early visit), if they were told about the visit. Sent as a personal message, signed by the presidency; replies come to your inbox.",
    title: "Visit reminder",
    personal: true,
    body: "Hi {first_name}! Just a quick reminder that [{visitors} from ]{leaders} {is_are} planning to {visit_kind} {day}[ at {time}]. If something has come up, please just let us know by replying to this message. See you soon!",
    vars: [
      v("first_name", "The member's first name", "Hyrum"),
      v("visitors", "Who's going", "Mark Johnson and Sam Hill"),
      v("leaders", 'Your presidency, e.g. "the Elders Quorum presidency"', "the Elders Quorum presidency"),
      v("visit_kind", '"visit you in your home", "call you" or "meet with you at church"', "visit you in your home"),
      v("day", '"today" or "tomorrow"', "today"),
      v("time", "The time (blank if none)", "7:00 PM"),
      v("is_are", '"is" or "are", to match who\'s coming', "are"),
    ],
  },
  {
    key: "visit_reminder_leaders",
    label: "Visit reminder (to the presidency)",
    about: "To the presidency and whoever is going, 3 hours before a planned visit.",
    title: "Visit {day}: {member}",
    body: "{date_time} ({visit_type})[, with {visitors}].",
    vars: [
      v("member", "Who's being visited", "Hyrum Johnson"),
      v("day", '"today" or "tomorrow"', "today"),
      v("date_time", "Date and time", "Thu, Oct 15 at 7:00 PM"),
      v("visit_type", '"home visit", "phone call" and so on', "home visit"),
      v("visitors", "Who's going", "Mark Johnson, Sam Hill"),
    ],
  },
  {
    key: "visit_invitation",
    label: "Visit invitation (suggested wording)",
    about: "The message suggested when you invite a member to a visit. You can still change it each time before sending.",
    personal: true,
    body: "Hi {first_name}! We would love to come visit you and your family in your home on {date}[ at {time}].[ {visitors} from {leaders} {is_are} looking forward to seeing you.] If that time doesn't work, please let us know a time that would be better for you.",
    vars: [
      v("first_name", "The member's first name", "Hyrum"),
      v("date", "The date", "Friday, October 16"),
      v("time", "The time (blank if none)", "7:00 PM"),
      v("visitors", "Who's going", "Mark Johnson and Sam Hill"),
      v("leaders", 'Your presidency, e.g. "the Elders Quorum presidency"', "the Elders Quorum presidency"),
      v("is_are", '"is" or "are", to match the number of visitors', "are"),
    ],
  },
  {
    key: "visit_scheduled",
    label: "Visit date and time (to the member)",
    about: 'When you plan a visit and tick "Send them the date and time". Sent as a personal message from you.',
    personal: true,
    body: "{visitors} will {visit_kind} {date_time}.",
    vars: [
      v("visitors", "Who's going", "Mark Johnson and Sam Hill"),
      v("visit_kind", '"visit you", "call you" or "meet with you at church"', "visit you"),
      v("date_time", "Date and time", "Fri, Oct 16 at 7:00 PM"),
    ],
  },
  {
    key: "lesson_reminder",
    label: "Lesson reminder",
    about: "To everyone (except the teacher) on Sunday evening for the next Sunday's lesson, and Saturday morning.",
    title: "{day}'s lesson[: {lesson_title}]",
    body: "[By {speaker}.] [Taught by {teacher}.] Tap to read the talk and share your thoughts.",
    vars: [
      v("day", '"This Sunday" or "Tomorrow"', "This Sunday"),
      v("lesson_title", "The talk's title", "Be One with Christ"),
      v("speaker", "Who gave the talk", "Elder Quentin L. Cook"),
      v("teacher", "Who's teaching", "Sam Hill"),
    ],
  },
  {
    key: "cfm_week",
    label: "Come, Follow Me this week (Sunday School)",
    about: "To Sunday School on Sunday evening: the coming week's Come, Follow Me reading.",
    title: "This week's Come, Follow Me: {reading}",
    body: "[{lesson_title}] Tap to read this week's lesson.",
    vars: [
      v("reading", "The week's reading", "Genesis 1–2; Moses 2–3"),
      v("lesson_title", "The lesson's title", "“In the Beginning God Created the Heaven and the Earth”"),
    ],
  },
  {
    key: "lesson_conference",
    label: "No lesson (conference weekend)",
    about: "Instead of the lesson reminder on a General or Stake Conference weekend.",
    title: "{day}: {conference}",
    body: "No {org} lesson {this_week}. We hope to see you at {conference}.",
    vars: [
      v("day", '"This Sunday" or "Tomorrow"', "This Sunday"),
      v("conference", '"General Conference" or "Stake Conference"', "General Conference"),
      v("org", "Your organization", "Elders Quorum"),
      v("this_week", '"this week" or "tomorrow"', "this week"),
    ],
  },
  {
    key: "event_reminder",
    label: "Event reminder",
    about: "To everyone (or the presidency, for presidency-only events) at each event's reminder times.",
    title: "Reminder: {event}",
    body: "{date_time}[ at {location}]",
    vars: [v("event", "The event's name", "Ward Christmas party"), v("date_time", "Date and time", "Sat, Dec 12 · 6:00 PM"), v("location", "Where (blank if none)", "the church gym")],
  },
  {
    key: "service_reminder",
    label: "Service reminder",
    about: "To each person signed up, at the service opportunity's two reminder times (a week and a day before, unless changed).",
    title: "{when}: {title}",
    body: "You signed up for {slots} on {date}. Thank you for serving!",
    vars: [
      v("when", '"Tomorrow", "Next week" and so on', "Tomorrow"),
      v("title", "The service opportunity", "Temple cleaning"),
      v("slots", "What they signed up for", "Saturday 9 AM"),
      v("date", "The date", "Sat, Oct 17"),
    ],
  },
];

export const templateDef = (key: string) => TEMPLATE_DEFS.find((t) => t.key === key);

/**
 * Fills in a template: {name} becomes its value, and a [bracketed part] is dropped
 * when anything in it is blank. Unknown {names} stay as written (so a typo shows).
 */
export function fillTemplate(text: string, vars: Record<string, string | null | undefined>): string {
  const value = (name: string) => (Object.prototype.hasOwnProperty.call(vars, name) ? (vars[name] ?? "").trim() : undefined);
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (m, name: string) => value(name) ?? m);
  const out = text.replace(/\[([^\[\]]*)\]/g, (_, inner: string) => {
    const names = [...inner.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    return names.some((n) => value(n) === "") ? "" : fill(inner);
  });
  return fill(out)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ ([.,!?])/g, "$1")
    .trim();
}
