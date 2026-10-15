import { DateTime } from "luxon";
import { requireAdmin } from "@/lib/auth";
import { memberListCsv, orgMemberList } from "@/lib/member-list";
import { formatDateTime } from "@/lib/time";

// Leaders download their organization's member list as a spreadsheet.
export async function GET(req: Request) {
  const user = await requireAdmin();
  const sp = new URL(req.url).searchParams;
  const members = orgMemberList(user.org_id, { show: sp.get("show") === "inactive" ? "inactive" : "active", q: sp.get("q") ?? "" });
  const csv = memberListCsv(members, user.org, (m) => (m.last_login_at ? formatDateTime(m.last_login_at, user.ward.timezone, "yyyy-LL-dd") : ""));
  const name = `${user.ward.name} ${user.orgLabel === user.ward.name ? "" : user.orgLabel} members ${DateTime.now().setZone(user.ward.timezone).toFormat("yyyy-LL-dd")}`.replace(/\s+/g, " ").replace(/[^\w .-]/g, "");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}.csv"`,
      "cache-control": "no-store",
    },
  });
}
