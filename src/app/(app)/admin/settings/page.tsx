import Link from "next/link";
import { requirePresidency } from "@/lib/auth";
import { Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { saveOrgSettings } from "./actions";
import { hasFeature } from "@/lib/orgs";
import { FEATURES, type Feature } from "@/lib/types";

import { monthlyLimit, phoneEnabled, textsThisMonth } from "@/lib/sms";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
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
        {!user.wardAdmin && (
          <p className="mt-3 max-w-xl text-sm text-muted">The ward&apos;s join code, time zone and list of organizations are managed by its ward administrators.</p>
        )}
      </Section>
      {user.wardAdmin && (
        <p className="mt-6 max-w-xl text-sm text-muted">
          The ward&apos;s organizations, join code and other ward settings are under{" "}
          <Link href="/ward-settings" className="link">
            More → Ward settings
          </Link>
          .
        </p>
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
