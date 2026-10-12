import { SubmitButton } from "@/components/client";
import { PRIVACY_NOTE, VISIT_TYPES, type VisitRow } from "@/lib/visits";
import { saveVisit } from "./actions";

export function VisitForm({ v, members, presidency, defaultMember, defaultVisitors, today }: { v?: VisitRow; members: { id: number; display_name: string }[]; presidency: { id: number; display_name: string }[]; defaultMember?: number; defaultVisitors: number[]; today: string }) {
  return (
    <form action={saveVisit} className="card max-w-2xl space-y-4">
      {v && <input type="hidden" name="id" value={v.id} />}
      <div>
        <label className="label" htmlFor="member_id">
          Who was visited
        </label>
        <select id="member_id" name="member_id" required className="input" defaultValue={v?.member_id ?? defaultMember ?? ""}>
          <option value="">Choose a member…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="date">
            Date
          </label>
          <input id="date" name="date" type="date" required className="input" defaultValue={v?.date ?? today} />
        </div>
        <div>
          <label className="label" htmlFor="type">
            Type of visit
          </label>
          <select id="type" name="type" className="input" defaultValue={v?.type ?? "home"}>
            {Object.entries(VISIT_TYPES).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <fieldset>
        <legend className="label">Who visited</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {presidency.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="visitor_id" value={p.id} defaultChecked={defaultVisitors.includes(p.id)} />
              {p.display_name}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="notes">
          Notes
        </label>
        <p className="mb-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">{PRIVACY_NOTE}</p>
        <textarea id="notes" name="notes" rows={3} maxLength={2000} className="input" defaultValue={v?.notes} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="follow_up" defaultChecked={!!v?.follow_up} /> Follow-up needed
      </label>
      {v && !!v.follow_up && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="follow_up_done" defaultChecked={!!v.follow_up_done} /> Follow-up done
        </label>
      )}
      <SubmitButton>Save visit</SubmitButton>
    </form>
  );
}
