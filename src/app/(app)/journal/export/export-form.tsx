"use client";

import { useEffect, useState } from "react";
import { appHandlesFiles, inApp, postToApp } from "@/lib/native-app";

type Range = "all" | "year" | "dates";

/** Choose which days, then print (or save as a PDF) or download a Word document. */
export function JournalExport({ count, first, today }: { count: number; first: string | null; today: string }) {
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState(first ?? today);
  const [to, setTo] = useState(today);
  const [where, setWhere] = useState<"browser" | "app" | "old-app">("browser");
  const [busy, setBusy] = useState<"" | "print" | "docx">("");
  const [problem, setProblem] = useState("");
  useEffect(() => setWhere(appHandlesFiles() ? "app" : inApp() ? "old-app" : "browser"), []);

  const query = (extra: Record<string, string>) => `/journal/book?${new URLSearchParams({ range, ...(range === "dates" ? { from, to } : {}), ...extra })}`;

  // In the phone app the page is fetched here and handed to the phone to print or share.
  async function inTheApp(kind: "print" | "docx") {
    setBusy(kind);
    setProblem("");
    try {
      const res = await fetch(query(kind === "docx" ? { format: "docx" } : {}), { credentials: "same-origin" });
      if (!res.ok) throw new Error();
      if (kind === "print") postToApp({ type: "print", html: await res.text() });
      else {
        const name = decodeURIComponent(/filename\*=UTF-8''([^;]+)/.exec(res.headers.get("content-disposition") || "")?.[1] || "Journal.docx");
        const base64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result).split(",")[1] || "");
          r.onerror = reject;
          res.blob().then((b) => r.readAsDataURL(b), reject);
        });
        postToApp({ type: "saveFile", name, mime: res.headers.get("content-type") || "application/octet-stream", base64 });
      }
    } catch {
      setProblem("That didn't work. Check your connection and try again.");
    } finally {
      setBusy("");
    }
  }

  const choices: [Range, string][] = [
    ["all", `The whole journal${count ? ` (${count === 1 ? "1 entry" : `${count} entries`})` : ""}`],
    ["year", "This year"],
    ["dates", "Days I choose"],
  ];
  return (
    <div className="card space-y-4">
      <fieldset className="space-y-2">
        <legend className="label">What to include</legend>
        {choices.map(([v, label]) => (
          <label key={v} className="flex items-center gap-2 text-sm">
            <input type="radio" name="range" value={v} checked={range === v} onChange={() => setRange(v)} />
            {label}
          </label>
        ))}
        {range === "dates" && (
          <div className="flex flex-wrap items-end gap-3 pl-6">
            <div>
              <label className="label" htmlFor="from">
                From
              </label>
              <input id="from" type="date" className="input" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="to">
                Through
              </label>
              <input id="to" type="date" className="input" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        )}
      </fieldset>

      {where === "old-app" ? (
        <p className="hint">Update the My Ward Link app to print or download your journal here, or open mywardlink.net in your phone&apos;s browser or on a computer.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {where === "app" ? (
            <>
              <button type="button" className="btn-primary" disabled={!!busy} onClick={() => inTheApp("print")}>
                {busy === "print" ? "Getting it ready…" : "🖨️ Print or save as PDF"}
              </button>
              <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => inTheApp("docx")}>
                {busy === "docx" ? "Getting it ready…" : "⬇️ Download Word document"}
              </button>
            </>
          ) : (
            <>
              <a href={query({ print: "1" })} target="_blank" rel="noreferrer" className="btn-primary">
                🖨️ Print or save as PDF
              </a>
              <a href={query({ format: "docx" })} className="btn-secondary">
                ⬇️ Download Word document
              </a>
            </>
          )}
        </div>
      )}
      {problem && <p className="text-sm text-danger">{problem}</p>}
      <p className="hint">
        Each day is a heading with what you wrote under it and the time you wrote it. To keep a PDF, choose Print, then Save as PDF (on a phone, share or save the
        print preview).
      </p>
    </div>
  );
}
