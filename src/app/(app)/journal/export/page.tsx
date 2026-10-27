import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { journalEntries } from "@/lib/journal";
import { journalAccess } from "@/lib/journal-session";
import { todayIn } from "@/lib/time";
import { PageHeader } from "@/components/ui";
import { JournalExport } from "./export-form";

export const metadata = { title: "Print or export your journal" };

export default async function JournalExportPage() {
  const user = await requireUser();
  const access = await journalAccess(user.id);
  if (!access) redirect("/journal/unlock?next=/journal/export");
  const entries = journalEntries(user.id, {}, access.mk);
  return (
    <>
      <PageHeader
        title="Print or export"
        back={{ href: "/journal", label: "My Journal" }}
        subtitle="Print your journal (or save it as a PDF), or download it as a Word document to keep, edit or back up."
      />
      <JournalExport count={entries.length} first={entries[0]?.date ?? null} today={todayIn(user.ward.timezone)} />
    </>
  );
}
