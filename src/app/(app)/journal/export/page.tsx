import { requireUser } from "@/lib/auth";
import { journalEntries } from "@/lib/journal";
import { todayIn } from "@/lib/time";
import { PageHeader } from "@/components/ui";
import { JournalExport } from "./export-form";

export const metadata = { title: "Print or export your journal" };

export default async function JournalExportPage() {
  const user = await requireUser();
  const entries = journalEntries(user.id);
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
