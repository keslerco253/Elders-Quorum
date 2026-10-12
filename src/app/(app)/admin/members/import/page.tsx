import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { loadImport } from "@/lib/import-store";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { applyImport, uploadImport } from "../actions";
import type { Mapping } from "@/lib/lcr-import";

export const metadata = { title: "Import from LCR" };

const FIELDS: [keyof Mapping, string][] = [
  ["name", "Name"],
  ["address", "Address"],
  ["phone", "Phone"],
  ["email", "Email"],
];

export default async function ImportPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const loaded = sp.file ? loadImport(user.ward_id, sp.file) : null;

  return (
    <>
      <PageHeader title="Import from LCR" back={{ href: "/admin/members", label: "Members" }} />
      <Flash msg={sp.msg} tone="danger" />
      {!loaded ? (
        <div className="card max-w-2xl space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>
              In LCR, open <strong>Membership → Member Lists</strong> and choose the <strong>Elders Quorum</strong> list.
            </li>
            <li>
              Click <strong>Print / Export</strong> and save as <strong>CSV</strong>.
            </li>
            <li>Upload the file here. You&apos;ll see a preview before anything changes.</li>
          </ol>
          <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">Only name, address, phone and email are kept. Gender, age and birth date are ignored.</p>
          <form action={uploadImport} className="space-y-3">
            <input type="file" name="file" accept=".csv,text/csv" required className="input" />
            <SubmitButton pendingText="Reading…">Preview import</SubmitButton>
          </form>
        </div>
      ) : (
        <form action={applyImport} className="space-y-5">
          <input type="hidden" name="file" value={sp.file} />
          <div className="card">
            <h2 className="h2 mb-3">Columns</h2>
            <div className="grid gap-3 sm:grid-cols-4">
              {FIELDS.map(([k, label]) => (
                <div key={k}>
                  <label className="label">{label}</label>
                  <select name={`map_${k}`} defaultValue={loaded.mapping[k]} className="input">
                    <option value="">(none)</option>
                    {loaded.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p className="hint mt-2">These were matched automatically. If you change them, the preview below won&apos;t update, but the import uses your choices.</p>
          </div>

          <div className="card">
            <h2 className="h2 mb-3">Preview</h2>
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge tone="success">{loaded.plan.creates.length} new</Badge>
              <Badge tone="info">{loaded.plan.updates.length} updated</Badge>
              <Badge>{loaded.plan.unchanged} unchanged</Badge>
              {loaded.plan.missing.length > 0 && <Badge tone="warn">{loaded.plan.missing.length} not in this file</Badge>}
              {loaded.plan.skipped > 0 && <Badge tone="danger">{loaded.plan.skipped} rows with no name skipped</Badge>}
            </div>
            {loaded.plan.creates.length > 0 && (
              <details className="mb-3" open={loaded.plan.creates.length <= 15}>
                <summary className="cursor-pointer text-sm font-semibold">New members</summary>
                <ul className="mt-2 space-y-1 text-sm">
                  {loaded.plan.creates.map((r, i) => (
                    <li key={i}>
                      {r.displayName} <span className="text-muted">{[r.phone, r.email].filter(Boolean).join(" · ")}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {loaded.plan.updates.length > 0 && (
              <details className="mb-3">
                <summary className="cursor-pointer text-sm font-semibold">Updated members</summary>
                <ul className="mt-2 space-y-1 text-sm">
                  {loaded.plan.updates.map((u) => (
                    <li key={u.id}>
                      {u.row.displayName} <span className="text-muted">({u.changes.join(", ")})</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {loaded.plan.missing.length > 0 && (
              <div className="rounded-lg bg-warn-soft p-3 text-sm text-warn">
                <p className="font-semibold">Not in this file (possibly moved out):</p>
                <p className="mt-1">{loaded.plan.missing.map((m) => m.name).join("; ")}</p>
                <label className="mt-2 flex items-center gap-2 font-medium">
                  <input type="checkbox" name="deactivate_missing" /> Mark these as moved out (removes their access)
                </label>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <SubmitButton pendingText="Importing…">Import</SubmitButton>
            <Link href="/admin/members/import" className="btn-secondary">
              Start over
            </Link>
          </div>
        </form>
      )}
    </>
  );
}
