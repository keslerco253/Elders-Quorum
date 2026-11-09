import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { phoneTextList } from "@/lib/phone-text";
import { PageHeader } from "@/components/ui";
import { PhoneTexter } from "./phone-texter";

export const metadata = { title: "Text from my phone" };

/** Messages → New → Text from my phone: the list, to text as a group or one at a time from the leader's own phone. */
export default async function PhoneTextPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const list = phoneTextList(user, sp.to ?? "");
  if (!list) notFound();
  const withPhone = list.people.filter((p): p is typeof p & { phone: string } => !!p.phone);
  const noPhone = list.people.filter((p) => !p.phone);
  return (
    <>
      <PageHeader
        title="Text from my phone"
        back={{ href: `/messages/new?${new URLSearchParams({ to: sp.to ?? "", body: sp.body ?? "" })}`, label: "New message" }}
        subtitle={`${list.label}: ${withPhone.length} ${withPhone.length === 1 ? "person" : "people"} with a phone number. Your phone's Messages app sends it, from your own number, so it's free; replies come to you.`}
      />
      <PhoneTexter people={withPhone.map((p) => ({ id: p.id, name: p.name, phone: p.phone }))} body={(sp.body ?? "").slice(0, 2000)} />
      {noPhone.length > 0 && (
        <p className="mt-4 max-w-2xl text-sm text-muted">
          No phone number, so not on this list: {noPhone.map((p) => p.name).join(", ")}. Send them the message in the app instead.
        </p>
      )}
    </>
  );
}
