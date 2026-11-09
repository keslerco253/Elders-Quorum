"use client";

import { useRef, useState } from "react";
import { fillTemplate, ONE_TEXT, TEXT_LINK_LENGTH, type TemplateDef } from "@/lib/template-defs";
import { SubmitButton } from "@/components/client";

/** One message's wording, with its fill-ins and a live preview. */
export function TemplateEditor({
  def,
  title,
  body,
  text,
  textFrom,
  signature,
  save,
}: {
  def: TemplateDef;
  title: string | null;
  body: string;
  /** Its own text wording (templates that have one). */
  text?: string | null;
  /** Who a text says it's from ("Elders Quorum"). */
  textFrom: string;
  signature: string;
  save: (fd: FormData) => Promise<void>;
}) {
  const [t, setT] = useState(title ?? "");
  const [b, setB] = useState(body);
  const [x, setX] = useState(text ?? "");
  const [focus, setFocus] = useState<"body" | "text">("body");
  const box = useRef<HTMLTextAreaElement>(null);
  const textBox = useRef<HTMLTextAreaElement>(null);
  const samples = Object.fromEntries(def.vars.map((v) => [v.name, v.sample]));
  const hasText = def.text !== undefined;
  const asText = hasText ? `${textFrom}: ${fillTemplate(x, samples)}`.replace(/\s+/g, " ").trim() : "";
  const letters = asText.length + TEXT_LINK_LENGTH;
  const insert = (name: string) => {
    const inText = hasText && focus === "text";
    const el = inText ? textBox.current : box.current;
    const cur = inText ? x : b;
    const at = el?.selectionStart ?? cur.length;
    const next = `${cur.slice(0, at)}{${name}}${cur.slice(el?.selectionEnd ?? at)}`;
    (inText ? setX : setB)(next);
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
        <textarea ref={box} id={`${def.key}-body`} name="body" value={b} onChange={(e) => setB(e.target.value)} onFocus={() => setFocus("body")} rows={4} maxLength={800} className="input" />
      </div>
      {hasText && (
        <div>
          <label className="label" htmlFor={`${def.key}-text`}>
            Text message
          </label>
          <textarea ref={textBox} id={`${def.key}-text`} name="text" value={x} onChange={(e) => setX(e.target.value)} onFocus={() => setFocus("text")} rows={2} maxLength={300} className="input" />
          <p className="mt-1 text-xs text-muted">
            The shorter wording sent by text. It has to fit in one text ({ONE_TEXT} letters), counting &quot;{textFrom}:&quot; at the start and the link at the end.
          </p>
        </div>
      )}
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
      {hasText && (
        <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
          <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs font-semibold">
            <span className="text-muted">As a text</span>
            <span className={letters > ONE_TEXT ? "text-danger" : "text-muted"}>
              {letters} of {ONE_TEXT} letters{letters > ONE_TEXT ? ` (too long by ${letters - ONE_TEXT})` : ""}
            </span>
          </div>
          <div>
            {asText} <span className="text-muted">https://mywardlink.net/l/123</span>
          </div>
          <p className="mt-1 text-xs text-muted">With the sample fill-ins. A much longer talk title or name can still run into a second text.</p>
        </div>
      )}
      <SubmitButton pendingText="Saving…">Save</SubmitButton>
    </form>
  );
}
