import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { PersonalReminders } from "@/components/personal-reminders";
import { canTextTodos, MAX_TODO_REMINDERS, MAX_TODO_TEXTS, TODO_WHEN } from "@/lib/personal-todos";
import { PERSONAL_EVENT_WHEN } from "@/lib/personal-events";
import { TEXTED_DEFAULTS, TEXTED_KINDS, textedReminders } from "@/lib/photo-event";
import { memberCanText } from "../../more/reminders/can-text";
import { saveTextedRemindersAction } from "./actions";

export const metadata = { title: "Texted events and to-dos" };

/** Site owner: the reminders that what they text in (EVENT, TODO, a picture) starts with. */
export default async function TextedRemindersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  if (!user.is_site_owner) redirect("/");
  const sp = await searchParams;
  const canText = canTextTodos(user.id);
  return (
    <>
      <PageHeader title="Texted events and to-dos" back={{ href: "/site", label: "Site owner" }} subtitle="The reminders that what you text to the app's number starts with." />
      <Flash msg={sp.msg} />
      <p className="mb-4 max-w-xl text-sm text-muted">
        Text <strong>EVENT</strong> or a picture and it goes on your calendar; text <strong>TODO</strong> and it goes on your to-do list. Each gets these reminders. You can still
        change any one item&apos;s reminders by opening it. Changes here apply to what you text from now on.
      </p>
      {TEXTED_KINDS.map(({ kind, title, hint }) => {
        const current = textedReminders(user.id, kind);
        const custom = JSON.stringify(current) !== JSON.stringify(TEXTED_DEFAULTS[kind]);
        return (
          <Section key={kind} title={title}>
            <form action={saveTextedRemindersAction} className="card max-w-xl space-y-3">
              <input type="hidden" name="kind" value={kind} />
              <PersonalReminders
                options={kind === "todo" ? TODO_WHEN : PERSONAL_EVENT_WHEN}
                initial={current}
                canText={canText}
                textReady={memberCanText(user)}
                canEmail={!!user.email}
                max={MAX_TODO_REMINDERS}
                maxTexts={MAX_TODO_TEXTS}
              />
              <p className="hint">{hint}</p>
              <div className="flex flex-wrap gap-2">
                <SubmitButton className="btn-primary btn-sm">Save</SubmitButton>
                {custom && (
                  <SubmitButton className="btn-secondary btn-sm" name="reset" value="1" pendingText="…">
                    Back to the starting ones
                  </SubmitButton>
                )}
              </div>
            </form>
          </Section>
        );
      })}
    </>
  );
}
