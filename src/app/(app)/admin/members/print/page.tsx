import Link from "next/link";
import { DateTime } from "luxon";
import { requireAdmin } from "@/lib/auth";
import { formatPhone } from "@/lib/contact";
import { orgMemberList, positionLabel } from "@/lib/member-list";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Member list" };

/** A plain, printable member list (names, callings, phone and email). */
export default async function PrintMembersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const members = orgMemberList(user.org_id, { show: sp.show === "inactive" ? "inactive" : "active", q: sp.q ?? "" });
  const title = user.orgLabel === user.ward.name ? user.ward.name : `${user.ward.name} ${user.orgLabel}`;
  return (
    <div className="print-sheet">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link href="/admin/members" className="text-sm text-muted hover:text-text">
          ← Members
        </Link>
        <span className="ml-auto" />
        <PrintButton />
      </div>
      <h1 className="text-xl font-bold">{title} members</h1>
      <p className="mb-3 text-sm text-muted">
        {members.length} {members.length === 1 ? "person" : "people"} · {DateTime.now().setZone(user.ward.timezone).toFormat("LLLL d, yyyy")} · Private: for leadership use only
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-text text-left">
            <th className="py-1.5 pr-3">Name</th>
            <th className="py-1.5 pr-3">Calling</th>
            <th className="py-1.5 pr-3">Phone</th>
            <th className="py-1.5">Email</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-b border-border align-top break-inside-avoid">
              <td className="py-1.5 pr-3 font-medium">{m.display_name}</td>
              <td className="py-1.5 pr-3">{positionLabel(m, user.org)}</td>
              <td className="py-1.5 pr-3 whitespace-nowrap">{m.phone ? formatPhone(m.phone) : ""}</td>
              <td className="py-1.5 break-all">{m.email ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
