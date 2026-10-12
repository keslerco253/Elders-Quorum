import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPresidency } from "@/lib/permissions";
import { formatDate, formatDateTime } from "@/lib/time";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { ROLE_LABELS, type Member } from "@/lib/types";
import { updateMember } from "../actions";
import { ContactFields, RoleSelect } from "../member-form";

export const metadata = { title: "Member" };

export default async function MemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const m = db().prepare("SELECT * FROM members WHERE id = ? AND ward_id = ?").get(Number(id), user.ward_id) as Member | undefined;
  if (!m) notFound();
  const presidency = isPresidency(user);
  const lastVisit = presidency ? (db().prepare("SELECT date, type FROM visits WHERE member_id = ? ORDER BY date DESC LIMIT 1").get(m.id) as { date: string; type: string } | undefined) : undefined;

  return (
    <>
      <PageHeader
        title={m.display_name}
        back={{ href: "/admin/members", label: "Members" }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{ROLE_LABELS[m.role]}</Badge>
            {m.status !== "active" && <Badge tone="warn">{m.status === "inactive" ? "Moved out / removed" : m.status}</Badge>}
            <span>{m.last_login_at ? `Last signed in ${formatDateTime(m.last_login_at, user.ward.timezone, "LLL d, yyyy")}` : "Hasn't signed in yet"}</span>
          </span>
        }
      />
      <Flash msg={sp.msg} />
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <form action={updateMember} className="card space-y-4">
          <input type="hidden" name="item_id" value={m.id} />
          <ContactFields m={m} />
          {presidency && (
            <div className="grid gap-4 sm:grid-cols-2">
              <RoleSelect value={m.role} />
              <div>
                <label className="label" htmlFor="status">
                  Status
                </label>
                <select id="status" name="status" className="input" defaultValue={m.status === "active" ? "active" : "inactive"}>
                  <option value="active">Active: can sign in</option>
                  <option value="inactive">Moved out / removed: no access</option>
                </select>
              </div>
            </div>
          )}
          <SubmitButton>Save</SubmitButton>
        </form>
        <div className="space-y-3">
          {m.phone && (
            <div className="card flex gap-2">
              <a href={`tel:${m.phone}`} className="btn-secondary flex-1">
                Call
              </a>
              <a href={`sms:${m.phone}`} className="btn-secondary flex-1">
                Text
              </a>
            </div>
          )}
          {m.address && (
            <a className="btn-secondary w-full" href={`https://maps.google.com/?q=${encodeURIComponent(m.address)}`} target="_blank" rel="noreferrer">
              Open in Maps
            </a>
          )}
          {presidency && (
            <div className="card text-sm">
              <div className="font-semibold">Presidency visits</div>
              <p className="mt-1 text-muted">{lastVisit ? `Last: ${formatDate(lastVisit.date)}` : "No visits recorded."}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/admin/visits/new?member=${m.id}`} className="btn-primary btn-sm">
                  Record a visit
                </Link>
                <Link href={`/admin/visits?member=${m.id}`} className="btn-secondary btn-sm">
                  History
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
