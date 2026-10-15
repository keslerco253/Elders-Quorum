import Link from "next/link";
import { requirePresidency } from "@/lib/auth";
import { Badge, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { TimezoneSelect } from "@/components/timezone-select";
import { addOrganization, deleteOrganization, setOrganizationActive, setOrganizationPresident, saveOrgSettings, saveWardSettings, setJoinCode, startAnotherWard } from "./actions";
import { db } from "@/lib/db";
import { hasFeature, orgRoster } from "@/lib/orgs";
import { FEATURES, STANDARD_ORGS, type Feature } from "@/lib/types";

import { monthlyLimit, phoneEnabled, textsThisMonth } from "@/lib/sms";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  // Ward settings are for the bishopric, when looking at the ward itself.
  const ward = user.org.kind === "ward" && user.wardLeader;
  const groups = ward
    ? (db()
        .prepare(
          `SELECT o.id, o.name, o.active,
             (SELECT COUNT(*) FROM org_members om WHERE om.org_id = o.id AND (om.official = 1 OR om.role <> 'member')) AS people,
             (SELECT COUNT(*) FROM org_members om WHERE om.org_id = o.id AND om.role = 'presidency') AS leaders
           FROM orgs o WHERE o.ward_id = ? AND o.kind = 'group' ORDER BY o.active DESC, o.name COLLATE NOCASE`,
        )
        .all(user.ward_id) as { id: number; name: string; active: number; people: number; leaders: number }[])
    : [];
  const roster = ward ? orgRoster(user.org_id) : [];
  return (
    <>
      <PageHeader title="Settings" back={{ href: "/admin", label: "Admin" }} />
      <Flash msg={sp.msg} />
      <Section title={user.org.kind === "ward" ? "Features" : "This organization"}>
        <form action={saveOrgSettings} className="card max-w-xl space-y-4">
          {user.org.kind === "group" && (
            <div>
              <label className="label" htmlFor="org-name">
                Name
              </label>
              <input id="org-name" name="name" required maxLength={60} className="input" defaultValue={user.org.name} />
            </div>
          )}
          <fieldset>
            <legend className="label">What {user.orgLabel} uses</legend>
            <div className="space-y-1">
              {(Object.keys(FEATURES) as Feature[]).map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={`feature_${f}`} defaultChecked={hasFeature(user.org, f)} /> {FEATURES[f]}
                </label>
              ))}
            </div>
            <p className="hint">Turned-off features are hidden from everyone in {user.orgLabel}. Nothing is deleted.</p>
          </fieldset>
          <SubmitButton>Save</SubmitButton>
        </form>
        {user.org.kind === "group" && (
          <p className="mt-3 max-w-xl text-sm text-muted">
            The join code, time zone and the list of organizations are managed by the bishopric, under {user.ward.name} in the menu at the top.
          </p>
        )}
      </Section>
      {ward && (
        <>
          <Section title="Ward">
            <form action={saveWardSettings} className="card max-w-xl space-y-4">
              <div>
                <label className="label" htmlFor="name">
                  Ward name
                </label>
                <input id="name" name="name" required maxLength={80} className="input" defaultValue={user.ward.name} />
              </div>
              <div>
                <label className="label" htmlFor="timezone">
                  Time zone
                </label>
                <TimezoneSelect id="timezone" name="timezone" defaultValue={user.ward.timezone} />
                <p className="hint">Lesson reminders go out Sunday at 7:00 PM and Saturday at 8:00 AM in this time zone.</p>
              </div>
              <SubmitButton>Save</SubmitButton>
            </form>
          </Section>
          <Section title="Join code">
            <div className="card max-w-xl space-y-3">
              <p className="text-sm">
                Everyone joins {user.ward.name} with <strong className="rounded bg-surface-2 px-2 py-1 font-mono text-lg tracking-widest">{user.ward.join_code}</strong>, then
                chooses their organizations. Change it if it gets shared outside the ward.
              </p>
              <Link href="/admin/invite" className="btn-primary btn-sm">
                Show QR code to invite members
              </Link>
              <form action={setJoinCode} className="flex flex-wrap gap-2">
                <SubmitButton name="mode" value="new" className="btn-secondary btn-sm" confirm="Make a new code? The old one stops working.">
                  Make a new code
                </SubmitButton>
              </form>
              <form action={setJoinCode} className="flex flex-wrap gap-2">
                <input type="hidden" name="mode" value="custom" />
                <input name="code" placeholder="Or your own, e.g. VILLAS-WARD" className="input max-w-56" />
                <SubmitButton className="btn-secondary btn-sm">Use this code</SubmitButton>
              </form>
            </div>
          </Section>
          <Section title="Organizations">
            <div className="card max-w-xl space-y-4 text-sm">
              <ul className="divide-y divide-border">
                {groups.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className={o.active ? "" : "text-muted"}>
                      <span className="font-medium">{o.name}</span>
                      {o.active ? (
                        <span className="text-muted">
                          {" "}
                          · {o.people} {o.people === 1 ? "member" : "members"}
                          {o.leaders ? "" : " · no presidency yet"}
                        </span>
                      ) : (
                        <span className="ml-2">
                          <Badge>Off</Badge>
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      {!!o.active && (
                        <a href={`/?org=${o.id}`} className="link">
                          Open
                        </a>
                      )}
                      <form action={setOrganizationActive}>
                        <input type="hidden" name="org_id" value={o.id} />
                        <input type="hidden" name="active" value={o.active ? "0" : "1"} />
                        <SubmitButton className="btn-secondary btn-sm" pendingText="…">
                          {o.active ? "Turn off" : "Turn on"}
                        </SubmitButton>
                      </form>
                      <form action={deleteOrganization}>
                        <input type="hidden" name="org_id" value={o.id} />
                        <SubmitButton className="btn-danger btn-sm" pendingText="Deleting…" confirm={`Delete ${o.name} and its lessons, events, sign-ups, messages and visit records?`}>
                          Delete
                        </SubmitButton>
                      </form>
                    </span>
                    {!!o.active && !o.leaders && roster.length > 0 && (
                      <form action={setOrganizationPresident} className="flex w-full flex-wrap items-center gap-2">
                        <input type="hidden" name="org_id" value={o.id} />
                        <select name="leader_id" className="input max-w-64 py-1 text-sm" defaultValue="" required aria-label={`President of ${o.name}`}>
                          <option value="" disabled>
                            Choose its president…
                          </option>
                          {roster.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.display_name}
                            </option>
                          ))}
                        </select>
                        <SubmitButton className="btn-secondary btn-sm">Set president</SubmitButton>
                      </form>
                    )}
                  </li>
                ))}
                {groups.length === 0 && <li className="py-2 text-muted">None yet. Add the organizations your ward uses below.</li>}
              </ul>
              <p className="hint">
                Turned-off organizations are hidden from members and send nothing; their members and everything in them are kept. Deleting removes an organization and
                everything in it for good.
              </p>
              <details>
                <summary className="cursor-pointer font-semibold">Add an organization</summary>
                <form action={addOrganization} className="mt-3 space-y-3">
                  <div>
                    <label className="label" htmlFor="new-org">
                      Name
                    </label>
                    <input id="new-org" name="name" required maxLength={60} className="input" list="org-names" placeholder="e.g. Relief Society" />
                    <datalist id="org-names">
                      {STANDARD_ORGS.filter((n) => !groups.some((g) => g.name === n)).map((n) => (
                        <option key={n} value={n} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="label" htmlFor="leader">
                      President (optional)
                    </label>
                    <select id="leader" name="leader_id" className="input" defaultValue="">
                      <option value="">Choose later</option>
                      {roster.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.display_name}
                        </option>
                      ))}
                    </select>
                    <p className="hint">They can add their counselors and secretary from Members.</p>
                  </div>
                  <fieldset>
                    <legend className="label">Uses</legend>
                    {(Object.keys(FEATURES) as Feature[]).map((f) => (
                      <label key={f} className="flex items-center gap-2">
                        <input type="checkbox" name={`feature_${f}`} defaultChecked /> {FEATURES[f]}
                      </label>
                    ))}
                  </fieldset>
                  <SubmitButton pendingText="Adding…">Add organization</SubmitButton>
                </form>
              </details>
            </div>
          </Section>
          <Section title="Another ward">
            <details id="start-ward" className="card max-w-xl text-sm">
              <summary className="cursor-pointer font-semibold">Start a new ward</summary>
              <form action={startAnotherWard} className="mt-3 space-y-3">
                <p className="text-muted">
                  For a ward that isn&apos;t in the app yet. You&apos;ll lead it in the app until you add its bishopric there.
                  {!user.is_site_owner && " The app's site owner approves new wards first; you'll get a message when it's ready."}
                </p>
                <input name="ward_name" required maxLength={80} className="input" placeholder="Ward name, e.g. Maple Ward" />
                {!user.is_site_owner && <input name="stake" maxLength={80} className="input" placeholder="Stake, e.g. Meridian Idaho Stake" />}
                <TimezoneSelect name="timezone" defaultValue={user.ward.timezone} />
                {!user.is_site_owner && <textarea name="note" rows={2} maxLength={1000} className="input" placeholder="Anything that helps us confirm it (optional)" />}
                <SubmitButton className="btn-secondary" pendingText="Sending…">
                  {user.is_site_owner ? "Start ward" : "Request the ward"}
                </SubmitButton>
              </form>
            </details>
          </Section>
        </>
      )}
      {phoneEnabled() && (
        <Section title="Texting">
          <div className="card max-w-xl space-y-2 text-sm">
            {user.ward.texting_enabled ? (
              <p>
                This month in {user.ward.name}: <strong>{textsThisMonth(user.ward_id, "notice") + textsThisMonth(user.ward_id, "reply")}</strong> of {monthlyLimit(user.ward_id)} reminder
                and message texts.
              </p>
            ) : (
              <p className="rounded-lg bg-warn-soft px-3 py-2 text-warn">
                Reminder and message texts are off for {user.ward.name}. Sign-in codes are still texted, and everything else goes by notification and email.
              </p>
            )}
            <p className="text-muted">Texting and its monthly limit are set by the app&apos;s site owner. At the limit, texts pause until next month and members get email instead.</p>
          </div>
        </Section>
      )}
    </>
  );
}
