import { SubmitButton } from "@/components/client";
import type { Signup, Slot } from "@/lib/signups";
import { saveSignup } from "./actions";

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
