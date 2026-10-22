import { SubmitButton } from "@/components/client";
import { SIGNUP_REMINDER_OPTIONS, type Signup, type Slot } from "@/lib/signups";
import { saveSignup } from "./actions";
import { FlyerField } from "@/components/flyer-field";
import { SlotsEditor } from "./slots-editor";
import { AnnounceField } from "@/components/announce-field";

export function SignupForm({
  s,
  announceTo,
  people,
}: {
  s?: Signup & { slots: Slot[] };
  announceTo?: { value: string; label: string }[];
  people?: { id: number; name: string }[];
}) {
  return (
    <form action={saveSignup} className="card max-w-2xl space-y-4">
      {s && <input type="hidden" name="item_id" value={s.id} />}
      <div>
        <label className="label" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          className="input"
          defaultValue={s?.title}
          placeholder="e.g. Meals for the Johnson family"
        />
      </div>
      <div>
        <div className="grid max-w-md grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="date">
              Date (optional)
            </label>
            <input
              id="date"
              name="date"
              type="date"
              className="input"
              defaultValue={s?.date ?? ""}
            />
          </div>
          <div>
            <label className="label" htmlFor="time">
              Start time (optional)
            </label>
            <input
              id="time"
              name="time"
              type="time"
              className="input"
              defaultValue={s?.time ?? ""}
            />
          </div>
        </div>
        <p className="hint">
          After this date it moves off the list. Members&apos; own reminders
          (&ldquo;1 hour before&rdquo;) count from the start time, or 9 AM if
          there isn&apos;t one.
        </p>
      </div>
      <div>
        <label className="label" htmlFor="description">
          Details
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="input"
          defaultValue={s?.description}
        />
      </div>
      <FlyerField
        file={s?.flyer_file}
        name={s?.flyer_name}
        hint="A PDF or a picture (PNG, JPEG or a phone photo), up to 15 MB. It shows on the opportunity's page."
      />
      <SlotsEditor
        slots={
          s?.slots.map((sl) => ({
            id: sl.id,
            label: sl.label,
            capacity: sl.capacity,
            taken: sl.entries.length,
          })) ?? []
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {(["reminder1_days", "reminder2_days"] as const).map((field, i) => (
          <div key={field}>
            <label className="label" htmlFor={field}>
              {i === 0 ? "Reminder" : "Second reminder"}
            </label>
            <select
              id={field}
              name={field}
              className="input"
              defaultValue={String((s ? s[field] : i === 0 ? 7 : 1) ?? "")}
            >
              {SIGNUP_REMINDER_OPTIONS.map(([v, label]) => (
                <option key={label} value={v ?? ""}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ))}
        <p className="hint sm:col-span-2">
          Sent to everyone signed up, when the opportunity has a date, at the hour set under Admin → Settings → Reminder times (8 AM unless changed).
        </p>
      </div>
      {s && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="closed" defaultChecked={!!s.closed} />{" "}
          Closed: no more sign-ups
        </label>
      )}
      {announceTo && (
        <AnnounceField
          choices={announceTo}
          people={people ?? []}
          label={s ? "Send an update" : "Send a notification"}
          about={
            s
              ? "Lets people know about the change when you save."
              : "Lets people know about it as soon as you save it."
          }
        />
      )}
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}
