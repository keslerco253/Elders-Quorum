import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { SupportNotice } from "@/components/support-notice";
import { phoneTextData } from "@/lib/phone-text";
import { PageHeader } from "@/components/ui";
import { PhoneTexter } from "./phone-texter";

export const metadata = { title: "Text from my phone" };

/** Messages → New → Text from my phone: choose who, write it (with their first name and a link), and text it from the leader's own phone. */
export default async function PhoneTextPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  if (user.support) return <SupportNotice user={user} title="Text from my phone" what="Texts from your phone go to the members of the organizations you lead." />;
  const sp = await searchParams;
  const data = phoneTextData(user, sp.to ?? "");
  if (!data) notFound();
  return (
    <>
      <PageHeader
        title="Text from my phone"
        back={{ href: `/messages/new?${new URLSearchParams({ to: sp.to ?? "", body: sp.body ?? "" })}`, label: "New message" }}
        subtitle="Your phone's Messages app sends it, from your own number, so it's free; replies come to you."
      />
      <PhoneTexter orgId={data.orgId} initial={data.initial} choices={data.choices} people={data.people} links={data.links} body={(sp.body ?? "").slice(0, 2000)} />
    </>
  );
}
