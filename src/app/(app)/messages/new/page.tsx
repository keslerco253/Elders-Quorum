import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { composeChoices, memberComposeChoices } from "@/lib/compose";
import { Empty, Flash, PageHeader } from "@/components/ui";
import { ComposeForm } from "../compose-form";
import { getOrg, hasFeature } from "@/lib/orgs";
import { ledOrgIds } from "@/lib/conversations";
import { MemberComposeForm } from "../member-compose-form";

export const metadata = { title: "New message" };

export default async function NewMessagePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const { orgs, people } = composeChoices(user.id);
  // Members (and leaders writing as a member) write to their leaders or a group.
  if (!orgs.length || sp.as === "member") {
    const choices = memberComposeChoices(user.id);
    const valid = choices.flatMap((o) => o.choices.map((c) => c.value));
    const back = orgs.length ? "/messages?tab=mine" : "/messages";
    return (
      <>
        <PageHeader title="New message" back={{ href: back, label: "Messages" }} subtitle="To your leaders, or a group you can send to. Replies show up in your Messages." />
        <Flash msg={sp.msg} tone="warn" />
        {choices.length ? <MemberComposeForm orgs={choices} initial={valid.includes(sp.to ?? "") ? sp.to! : valid.includes(`p:${user.org_id}:0`) ? `p:${user.org_id}:0` : ""} /> : <Empty>There&apos;s no one to write to here: your leaders don&apos;t take messages through the app, or none are set up yet. Messages they send still show up in Messages.</Empty>}
      </>
    );
  }
  const valid = [...orgs.flatMap((o) => o.audiences.map((a) => a.value)), ...people.map((p) => p.value)];
  const initial = valid.includes(sp.to ?? "") ? sp.to! : "";
  return (
    <>
      <PageHeader title="New message" back={{ href: "/messages", label: "Messages" }} subtitle="To one person, or to everyone in an organization, its presidency or a group." />
      <Flash msg={sp.msg} tone="warn" />
      <ComposeForm orgs={orgs} people={people} initial={initial} agendaOrgs={ledOrgIds(user.id).filter((id) => { const o = getOrg(id); return !!o && hasFeature(o, "todos"); })} />
      <p className="mt-3 text-sm text-muted">
        Groups (like a committee) are set up under{" "}
        <Link href="/admin/groups" className="link">
          Admin → Message groups
        </Link>
        . To write to another organization&apos;s leaders as a member,{" "}
        <Link href="/messages/new?as=member" className="link">
          use this instead
        </Link>
        .
      </p>
    </>
  );
}
