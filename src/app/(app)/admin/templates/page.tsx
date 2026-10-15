import { requirePresidency } from "@/lib/auth";
import { TEMPLATE_DEFS } from "@/lib/template-defs";
import { orgTemplate } from "@/lib/templates";
import { formatDateTime } from "@/lib/time";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { resetMessageTemplate, saveMessageTemplate } from "./actions";
import { TemplateEditor } from "./template-editor";

export const metadata = { title: "Message wording" };

/** The wording of messages the app sends on its own, which each organization can make its own. */
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const signature = user.org.kind === "ward" ? "The bishopric" : `The ${user.orgLabel} presidency`;
  return (
    <>
      <PageHeader
        title="Message wording"
        back={{ href: "/admin", label: "Admin" }}
        subtitle={`The reminders and messages the app sends for ${user.orgLabel} on its own. Change any of them to sound like you; other organizations keep their own.`}
      />
      <Flash msg={sp.msg} tone="success" />
      <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2 text-sm">
        Words in <span className="font-mono">{"{curly brackets}"}</span> are filled in for each message. Text in <span className="font-mono">[square brackets]</span> is left out when something in it is blank (for example{" "}
        <span className="font-mono">[ at {"{location}"}]</span> for an event with no place).
      </p>
      <ul className="space-y-3">
        {TEMPLATE_DEFS.map((def) => {
          const t = orgTemplate(user.org_id, def.key);
          return (
            <li key={def.key} id={def.key} className="scroll-mt-20">
              <details className="card" open={sp.open === def.key}>
                <summary className="cursor-pointer">
                  <span className="font-semibold">{def.label}</span> {t.custom ? <Badge tone="info">Your wording</Badge> : <Badge>App&apos;s wording</Badge>}
                  <div className="mt-1 text-sm text-muted">{def.about}</div>
                </summary>
                <div className="mt-4 space-y-3">
                  <TemplateEditor key={`${t.title}|${t.body}`} def={def} title={t.title} body={t.body} signature={signature} save={saveMessageTemplate} />
                  {t.custom && (
                    <form action={resetMessageTemplate} className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs text-muted">
                      <input type="hidden" name="key" value={def.key} />
                      <span>
                        Changed{t.updated_by_name ? ` by ${t.updated_by_name}` : ""}
                        {t.updated_at ? `, ${formatDateTime(t.updated_at, user.ward.timezone, "LLL d, yyyy")}` : ""}.
                      </span>
                      <SubmitButton className="btn-secondary btn-sm" pendingText="Resetting…" confirm="Go back to the app's wording?">
                        Reset to the app&apos;s wording
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </>
  );
}
