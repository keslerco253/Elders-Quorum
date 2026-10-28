import Link from "next/link";
import { withOrg } from "@/lib/org-cookie";
import { OrgLink } from "@/components/org-link";
import { HandbookLinks } from "@/components/handbook-link";
import { CALLINGS } from "@/lib/handbook";
import { requirePresidency } from "@/lib/auth";
import { Badge, Empty, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { orgRoster } from "@/lib/orgs";
import { wardPeople } from "@/lib/announce";
import { PersonPicker } from "./person-picker";
import { MAX_CALLING_NAME, orgCallings, type OrgCalling } from "@/lib/org-callings";
import { regularTeachers, WEEK_WORDS, WEEKS, weeksText } from "@/lib/regular-teachers";
import { leadersWord } from "@/lib/types";
import { addCalling, addHolder, deleteCalling, removeHolder, saveTeacherWeeks, updateCalling } from "./actions";

export const metadata = { title: "Callings" };

const SUGGESTIONS = ["Teacher", "Activities Committee", "Activities Coordinator", "Ministering Coordinator", "Music Leader", "Service Coordinator", "Temple and Family History Leader"];

function Options({ calling }: { calling?: Pick<OrgCalling, "leader" | "teaches"> }) {
  return (
    <div className="space-y-1 text-sm">
      <label className="flex items-start gap-2">
        <input type="checkbox" name="teaches" defaultChecked={!!calling?.teaches} className="mt-1" />
        <span>
          <span className="font-medium">Teaches lessons</span>
          <span className="block text-muted">Choose which Sundays of the month each person teaches. They&apos;re put on those lessons automatically.</span>
        </span>
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="leader" defaultChecked={!!calling?.leader} className="mt-1" />
        <span>
          <span className="font-medium">Gives Leadership access</span>
          <span className="block text-muted">While they hold it, they can use the Admin tools like the presidency. Taken back when they&apos;re released.</span>
        </span>
      </label>
    </div>
  );
}

export default async function CallingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const callings = orgCallings(user.org_id);
  const roster = orgRoster(user.org_id);
  // Everyone else in the ward, for "Show all ward members".
  const inRoster = new Set(roster.map((p) => p.id));
  const wardOthers = wardPeople(user.ward_id).filter((p) => !inRoster.has(p.id));
  const byWeek = new Map(regularTeachers(user.org_id).map((r) => [r.week, r.display_name]));

  return (
    <>
      <PageHeader
        title="Callings"
        back={{ href: "/admin", label: "Admin" }}
        subtitle={`Callings in ${user.orgLabel} beyond the ${leadersWord(user.org)}, like a teacher or an activities committee. Someone can hold more than one.`}
      />
      <Flash msg={sp.msg} />
      <HandbookLinks chapters={[CALLINGS]} />
      <p className="hint mb-4">
        {user.org.kind === "ward" ? "Bishopric callings" : "Presidency callings (president, counselors, secretary and assistant secretary)"} are set on each person&apos;s page:{" "}
        <Link href="/admin/members" className="link">
          Members
        </Link>{" "}
        → tap a person → Access level and Calling.
      </p>

      <div className="space-y-4">
        {callings.length === 0 && <Empty>No added callings yet. Add one below.</Empty>}
        {callings.map((c) => {
          const others = roster.filter((p) => !c.holders.some((h) => h.member_id === p.id));
          const outside = wardOthers.filter((p) => !c.holders.some((h) => h.member_id === p.id));
          return (
            <section key={c.id} id={`calling-${c.id}`} className="card scroll-mt-20 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="h2 mr-auto">{c.name}</h2>
                {!!c.teaches && <Badge>Teaches</Badge>}
                {!!c.leader && <Badge tone="info">Leadership access</Badge>}
              </div>
              {c.holders.length === 0 ? (
                <p className="text-sm text-muted">No one holds this calling yet.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {c.holders.map((h) => (
                    <li key={h.member_id} className="space-y-2 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <OrgLink href={withOrg(`/admin/members/${h.member_id}`, user.org_id)} className="mr-auto font-medium hover:underline">
                          {h.display_name}
                        </OrgLink>
                        <form action={removeHolder}>
                          <input type="hidden" name="calling_id" value={c.id} />
                          <input type="hidden" name="member_id" value={h.member_id} />
                          <SubmitButton className="btn-secondary btn-sm" confirm={`Release ${h.display_name} from ${c.name}?`}>
                            Release
                          </SubmitButton>
                        </form>
                      </div>
                      {!!c.teaches && (
                        <form action={saveTeacherWeeks} className="space-y-2">
                          <input type="hidden" name="calling_id" value={c.id} />
                          <input type="hidden" name="member_id" value={h.member_id} />
                          <div className="text-sm text-muted">{h.weeks.length ? `Teaches the ${weeksText(h.weeks)} of each month.` : "Teaches on:"}</div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            {WEEKS.map((w) => {
                              const other = byWeek.get(w);
                              const mine = h.weeks.includes(w);
                              return (
                                <label key={w} className="flex items-center gap-1.5">
                                  <input type="checkbox" name={`week${w}`} defaultChecked={mine} />
                                  {WEEK_WORDS[w - 1]} Sunday
                                  {!mine && other && <span className="text-xs text-muted">({other})</span>}
                                </label>
                              );
                            })}
                          </div>
                          <SubmitButton className="btn-primary btn-sm">Save Sundays</SubmitButton>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!!c.teaches && (
                <p className="hint">
                  One teacher per Sunday: choosing a Sunday someone else has (shown in parentheses) moves it to this person. 5th Sundays are filled in each time under Manage lessons.
                </p>
              )}
              {(others.length > 0 || outside.length > 0) && (
                <form action={addHolder} className="flex flex-wrap items-start gap-2">
                  <input type="hidden" name="calling_id" value={c.id} />
                  <PersonPicker
                    id={`add-${c.id}`}
                    inOrg={others.map((p) => ({ id: p.id, name: p.display_name }))}
                    others={outside}
                    wardName={user.ward.name}
                    orgLabel={user.orgLabel}
                  />
                  <div className="pt-6">
                    <SubmitButton className="btn-secondary">Add</SubmitButton>
                  </div>
                </form>
              )}
              <details className="text-sm">
                <summary className="cursor-pointer text-muted">Rename or change this calling</summary>
                <form action={updateCalling} className="mt-3 space-y-3">
                  <input type="hidden" name="calling_id" value={c.id} />
                  <input name="name" className="input" defaultValue={c.name} maxLength={MAX_CALLING_NAME} required aria-label="Calling name" />
                  <Options calling={c} />
                  <div className="flex flex-wrap gap-2">
                    <SubmitButton className="btn-primary btn-sm">Save</SubmitButton>
                  </div>
                </form>
                <form action={deleteCalling} className="mt-2">
                  <input type="hidden" name="calling_id" value={c.id} />
                  <SubmitButton className="btn-danger btn-sm" confirm={`Remove the ${c.name} calling? ${c.holders.length ? "Everyone holding it is released." : ""}`}>
                    Remove this calling
                  </SubmitButton>
                </form>
              </details>
            </section>
          );
        })}
      </div>

      <Section title="Add a calling">
        <form action={addCalling} className="card space-y-3">
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input id="name" name="name" className="input" list="calling-names" maxLength={MAX_CALLING_NAME} placeholder="Teacher, Activities Committee…" required />
            <datalist id="calling-names">
              {SUGGESTIONS.filter((s) => !callings.some((c) => c.name.toLowerCase() === s.toLowerCase())).map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <Options />
          <SubmitButton>Add calling</SubmitButton>
        </form>
      </Section>
    </>
  );
}
