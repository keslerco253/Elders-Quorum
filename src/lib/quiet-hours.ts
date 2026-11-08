import { DateTime } from "luxon";
import { db } from "./db";
import { reminderSettings } from "./reminder-settings";

/** Texts from 9 PM wait until the morning hour (8 AM unless an organization chose another). */
export const QUIET_FROM_HOUR = 21;

/**
 * When a text for this organization should go out instead of now (UTC ISO), or null to
 * send it now: from 9 PM until the organization's morning hour in the ward's time zone.
 */
export function quietUntil(orgId: number, now: DateTime = DateTime.utc()): string | null {
  // Tests send at any hour (QUIET_HOURS=off), except the ones about quiet hours.
  if (process.env.QUIET_HOURS === "off") return null;
  const row = db().prepare("SELECT w.timezone FROM orgs o JOIN wards w ON w.id = o.ward_id WHERE o.id = ?").get(orgId) as { timezone: string } | undefined;
  if (!row) return null;
  const morning = reminderSettings(orgId).morningHour;
  const local = now.setZone(row.timezone);
  if (local.hour >= QUIET_FROM_HOUR) return local.plus({ days: 1 }).set({ hour: morning, minute: 0, second: 0, millisecond: 0 }).toUTC().toISO()!;
  if (local.hour < morning) return local.set({ hour: morning, minute: 0, second: 0, millisecond: 0 }).toUTC().toISO()!;
  return null;
}

/** "8 AM": the morning hour, for messages. */
export const morningText = (orgId: number) => DateTime.fromObject({ hour: reminderSettings(orgId).morningHour }).toFormat("h a");
