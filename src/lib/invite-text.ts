import { DateTime } from "luxon";

// Wording for a personal visit invitation. No database here, so the plan form
// can rebuild the message in the browser as the date, time and visitors change.

/** "Daniel Carter and Michael Nguyen" */
export function joinNames(names: string[]) {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
}

/**
 * The suggested personal message (leaders can edit it before sending).
 * leaders: who's coming, e.g. "the Elders Quorum presidency" or "the bishopric".
 */
export function inviteMessage(memberFirstName: string, date: string, time: string | null, visitorNames: string[], leaders = "the presidency") {
  const d = DateTime.fromISO(date);
  const when = (d.isValid ? d.toFormat("cccc, LLLL d") : "a day that works for you") + (time && d.isValid ? ` at ${DateTime.fromFormat(time, "HH:mm").toFormat("h:mm a")}` : "");
  const who = joinNames(visitorNames);
  return `Hi ${memberFirstName}! We would love to come visit you and your family in your home on ${when}.${who ? ` ${who} from ${leaders} ${visitorNames.length > 1 ? "are" : "is"} looking forward to seeing you.` : ""} If that time doesn't work, please let us know a time that would be better for you.`;
}
