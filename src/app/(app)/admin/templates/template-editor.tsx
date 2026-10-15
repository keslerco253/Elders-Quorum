"use client";

import { useRef, useState } from "react";
import { fillTemplate, type TemplateDef } from "@/lib/template-defs";
import { SubmitButton } from "@/components/client";

/** One message's wording, with its fill-ins and a live preview. */
export function TemplateEditor({ def, title, body, signature, save }: { def: TemplateDef; title: string | null; body: string; signature: string; save: (fd: FormData) => Promise<void> }) {
  const [t, setT] = useState(title ?? "");
  const [b, setB] = useState(body);
  const box = useRef<HTMLTextAreaElement>(null);
  const samples = Object.fromEntries(def.vars.map((v) => [v.name, v.sample]));
  const insert = (name: string) => {
    const el = box.current;
    const at = el?.selectionStart ?? b.length;
    const next = `${b.slice(0, at)}{${name}}${b.slice(el?.selectionEnd ?? at)}`;
    setB(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + name.length + 2, at + name.length + 2);
    });
  };
  return (
    <form action={save} className="space-y-3">
      <input type="hidden" name="key" value={def.key} />
      {def.title !== undefined && (
        <div>
          <label className="label" htmlFor={`${def.key}-title`}>
            Title
          </label>
          <input id={`${def.key}-title`} name="title" value={t} onChange={(e) => setT(e.target.value)} maxLength={120} className="input" />
        </div>
      )}
      <div>
        <label className="label" htmlFor={`${def.key}-body`}>
          Message
        </label>
        <textarea ref={box} id={`${def.key}-body`} name="body" value={b} onChange={(e) => setB(e.target.value)} rows={4} maxLength={800} className="input" />
      </div>
      <div className="text-xs">
        <div className="mb-1 text-muted">Tap to add (filled in for each message):</div>
        <div className="flex flex-wrap gap-1.5">
          {def.vars.map((v) => (
            <button key={v.name} type="button" onClick={() => insert(v.name)} title={v.desc} className="rounded-full bg-surface-2 px-2 py-0.5 font-mono hover:bg-accent-soft">
              {`{${v.name}}`}
            </button>
          ))}
        </div>
        <ul className="mt-2 space-y-0.5 text-muted">
          {def.vars.map((v) => (
            <li key={v.name}>
              <span className="font-mono">{`{${v.name}}`}</span>: {v.desc}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
        <div className="mb-1 text-xs font-semibold text-muted">Preview</div>
        {def.title !== undefined && !def.personal && <div className="font-semibold">{fillTemplate(t, samples)}</div>}
        <div className="whitespace-pre-wrap">{fillTemplate(b, samples)}</div>
        {def.personal && <div className="mt-2 text-muted">- {signature}</div>}
      </div>
      <SubmitButton pendingText="Saving…">Save</SubmitButton>
    </form>
  );
}
