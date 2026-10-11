import type { Member } from "@/lib/types";

export function ContactFields({ m }: { m?: Partial<Member> }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">
            Name (as in LCR)
          </label>
          <input id="name" name="name" required className="input" defaultValue={m?.name} placeholder="Last, First" />
        </div>
        <div>
          <label className="label" htmlFor="display_name">
            Display name
          </label>
          <input id="display_name" name="display_name" className="input" defaultValue={m?.display_name} placeholder="First Last" />
          <p className="hint">Shown on comments and assignments.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" className="input" defaultValue={m?.email ?? ""} />
          <p className="hint">Needed to sign in.</p>
        </div>
        <div>
          <label className="label" htmlFor="phone">
            Phone
          </label>
          <input id="phone" name="phone" type="tel" className="input" defaultValue={m?.phone ?? ""} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="address">
          Address
        </label>
        <textarea id="address" name="address" rows={2} className="input" defaultValue={m?.address ?? ""} />
      </div>
    </>
  );
}

export function RoleSelect({ value }: { value?: string }) {
  return (
    <div>
      <label className="label" htmlFor="role">
        Access level
      </label>
      <select id="role" name="role" className="input" defaultValue={value ?? "member"}>
        <option value="member">Member: lessons, calendar, plans, sign-ups</option>
        <option value="admin">Admin (bishop, high councilor): admin tools except home visits and to-dos</option>
        <option value="presidency">Presidency: everything</option>
      </select>
    </div>
  );
}
