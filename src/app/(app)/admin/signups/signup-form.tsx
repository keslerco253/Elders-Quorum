import { SubmitButton } from "@/components/client";
import { SIGNUP_REMINDER_OPTIONS, type Signup, type Slot } from "@/lib/signups";
import { saveSignup } from "./actions";
import { UPLOAD_ACCEPT } from "@/lib/upload-names";

export function SignupForm({ s }: { s?: Signup & { slots: Slot[] } }) {
  return (
    <form action={saveSignup} className="card max-w-2xl space-y-4">
      {s && <input type="hidden" name="item_id" value={s.id} />}
      <div>
        <label className="label" htmlFor="title">
          Title
        </label>
        <input id="title" name="title" required className="input" defaultValue={s?.title} placeholder="e.g. Meals for the Johnson family" />
      </div>
      <div>
        <label className="label" htmlFor="date">
          Date (optional)
        </label>
        <input id="date" name="date" type="date" className="input max-w-xs" defaultValue={s?.date ?? ""} />
        <p className="hint">After this date it moves off the list.</p>
      </div>
      <div>
        <label className="label" htmlFor="description">
          Details
        </label>
        <textarea id="description" name="description" rows={3} className="input" defaultValue={s?.description} />
      </div>
      <div>
        <label className="label" htmlFor="flyer">
          Flyer (optional)
        </label>
        {s?.flyer_file && (
          <p className="mb-2 text-sm">
            Current: {s.flyer_name}{" "}
            <label className="ml-2 text-muted">
              <input type="checkbox" name="remove_flyer" /> remove
            </label>
          </p>
        )}
        <input id="flyer" name="flyer" type="file" accept={UPLOAD_ACCEPT} className="input" />
        <p className="hint">A PDF or a picture (PNG, JPEG or a phone photo), up to 15 MB. It shows on the opportunity&apos;s page.</p>
      </div>
      <div>
        <label className="label" htmlFor="slots">
          Slots: one per line, with how many people are needed
        </label>
        <textarea
          id="slots"
          name="slots"
          rows={6}
          required
          className="input font-mono text-sm"
          defaultValue={s?.slots.map((sl) => `${sl.label} | ${sl.capacity}`).join("\n")}
          placeholder={"Helpers | 6\nBring a trailer | 1\n\nor for meals:\nMonday dinner | 1\nTuesday dinner | 1"}
        />
        <p className="hint">If you remove or rename a slot, the people signed up for it are removed.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["reminder1_days", "reminder2_days"] as const).map((field, i) => (
          <div key={field}>
            <label className="label" htmlFor={field}>
              {i === 0 ? "Reminder" : "Second reminder"}
            </label>
            <select id={field} name={field} className="input" defaultValue={String((s ? s[field] : i === 0 ? 7 : 1) ?? "")}>
              {SIGNUP_REMINDER_OPTIONS.map(([v, label]) => (
                <option key={label} value={v ?? ""}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ))}
        <p className="hint sm:col-span-2">Sent to everyone signed up (from 8 AM), when the opportunity has a date.</p>
      </div>
      {s ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="closed" defaultChecked={!!s.closed} /> Closed: no more sign-ups
        </label>
      ) : (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="announce" /> Send a notification to everyone in the organization
        </label>
      )}
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}
