import { DateTime } from "luxon";
import { fillTemplate, templateDef } from "./template-defs";

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
export function inviteMessage(memberFirstName: string, date: string, time: string | null, visitorNames: string[], leaders = "the presidency", template = templateDef("visit_invitation")!.body) {
  const d = DateTime.fromISO(date);
  return fillTemplate(template, {
    first_name: memberFirstName,
    date: d.isValid ? d.toFormat("cccc, LLLL d") : "a day that works for you",
    time: time && d.isValid ? DateTime.fromFormat(time, "HH:mm").toFormat("h:mm a") : "",
    visitors: joinNames(visitorNames),
    leaders,
    is_are: visitorNames.length > 1 ? "are" : "is",
  });
}
