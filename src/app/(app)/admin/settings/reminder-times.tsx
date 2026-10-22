import { SubmitButton } from "@/components/client";
import { Section } from "@/components/ui";
import { hasFeature } from "@/lib/orgs";
import {
  LESSON_DAYS,
  MEETING_MINUTES,
  reminderSettings,
  VISIT_HOURS,
  type LessonWhen,
} from "@/lib/reminder-settings";
import type { Org } from "@/lib/types";
import { saveReminderTimes } from "./actions";

const hourLabel = (h: number) =>
  `${((h + 11) % 12) + 1}:00 ${h < 12 ? "AM" : "PM"}`;

/** Two lesson reminders: which day before the Sunday (or none) and what time. */
function LessonRows({ name, value }: { name: string; value: LessonWhen[] }) {
  return (
    <div className="space-y-2">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <select
            name={`${name}_days_${i}`}
            defaultValue={value[i] ? String(value[i].days) : ""}
            className="input w-auto"
            aria-label={`${i === 0 ? "First" : "Second"} reminder: day`}
          >
            <option value="">
              {i === 0 ? "No reminder" : "No second reminder"}
            </option>
            {LESSON_DAYS.map(([d, label]) => (
              <option key={d} value={d}>
                {label}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted">at</span>
          <input
            name={`${name}_time_${i}`}
            type="time"
            defaultValue={value[i]?.time ?? "08:00"}
            className="input w-auto"
            aria-label={`${i === 0 ? "First" : "Second"} reminder: time`}
          />
        </div>
      ))}
    </div>
  );
}

/** When this organization's automatic reminders go out. */
export function ReminderTimes({ org }: { org: Org }) {
  const s = reminderSettings(org.id);
  const lessons = hasFeature(org, "lessons");
  const visits = hasFeature(org, "visits");
  const mornings = hasFeature(org, "signups") || hasFeature(org, "todos");
  const meetings = hasFeature(org, "todos");
  if (!lessons && !visits && !mornings) return null;
  return (
    <Section title="Reminder times">
      <form action={saveReminderTimes} className="card max-w-xl space-y-5">
        {lessons && (
          <fieldset className="space-y-2">
            <legend className="label">Lesson reminder (to everyone)</legend>
            <LessonRows name="lesson" value={s.lesson} />
            <p className="hint">
              About the coming Sunday&apos;s lesson. Members who set their own
              lesson reminders get theirs instead.
            </p>
          </fieldset>
        )}
        {lessons && (
          <fieldset className="space-y-2">
            <legend className="label">Teacher&apos;s reminder</legend>
            <LessonRows name="teacher" value={s.teacher} />
            <p className="hint">
              &ldquo;You&apos;re teaching this Sunday&rdquo;, asking them to
              confirm. The teacher gets this instead of the lesson reminder.
            </p>
          </fieldset>
        )}
        {visits && (
          <div>
            <label className="label" htmlFor="visit_hours">
              Visit reminder
            </label>
            <select
              id="visit_hours"
              name="visit_hours"
              defaultValue={String(s.visitHours)}
              className="input w-auto"
            >
              <option value="0">No reminder</option>
              {VISIT_HOURS.map((h) => (
                <option key={h} value={h}>
                  {h === 24
                    ? "1 day before"
                    : `${h} hour${h === 1 ? "" : "s"} before`}
                </option>
              ))}
            </select>
            <p className="hint">
              To the presidency, whoever is going, and the member (if they were
              told). Never before 7 AM: then it goes the evening before.
            </p>
          </div>
        )}
        {mornings && (
          <div>
            <label className="label" htmlFor="morning_hour">
              Service and assignment reminders go out at
            </label>
            <select
              id="morning_hour"
              name="morning_hour"
              defaultValue={String(s.morningHour)}
              className="input w-auto"
            >
              {[5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
            <p className="hint">
              On the day each one is set for (chosen on the service opportunity
              or assignment).
            </p>
          </div>
        )}
        {meetings && (
          <div>
            <label className="label" htmlFor="meeting_minutes">
              Presidency meeting reminder
            </label>
            <select
              id="meeting_minutes"
              name="meeting_minutes"
              defaultValue={String(s.meetingMinutes)}
              className="input w-auto"
            >
              {MEETING_MINUTES.map(([m, label]) => (
                <option key={m} value={m}>
                  {label}
                </option>
              ))}
            </select>
            <p className="hint">
              For meetings scheduled under Presidency meetings (upcoming ones
              change too).
            </p>
          </div>
        )}
        <SubmitButton>Save reminder times</SubmitButton>
        <p className="hint">
          Event reminders are set on each event. Members can change their own
          under My reminders.
        </p>
      </form>
    </Section>
  );
}
