"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PdfPages } from "@/components/pdf-pages";
import { isPicture, UPLOAD_ACCEPT } from "@/lib/upload-names";
import {
  MIN_WIDTH,
  mediaBlock,
  mediaProps,
  newBlockId,
  type Align,
  type Block,
  type MediaBlock, sizeClass, TEXT_SIZES, type TextSize } from "@/lib/plan-blocks";

// Builds a plan like a web page: headings, text, pictures and PDFs. Blocks are
// dragged by their handle to move them; pictures and PDFs are sized by dragging
// their corner (or the size buttons) and placed left, center or right.

type Uploading = { id: string; type: "uploading"; name: string };
type Item = Block | Uploading;

const SIZES: [string, number][] = [
  ["S", 33],
  ["M", 50],
  ["L", 75],
  ["Full", 100],
];

export function PlanEditor({ initial }: { initial: Block[] }) {
  const [items, setItems] = useState<Item[]>(
    initial.length ? initial : [{ id: newBlockId(), type: "text", text: "" }],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; to: number } | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const page = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<string, HTMLElement>());
  const filePicker = useRef<HTMLInputElement>(null);

  const update = useCallback((fn: (items: Item[]) => Item[]) => {
    setItems(fn);
    setDirty(true);
  }, []);
  const change = (id: string, patch: Partial<Block>) =>
    update((list) =>
      list.map((b) => (b.id === id ? ({ ...b, ...patch } as Item) : b)),
    );
  const remove = (id: string) =>
    update((list) => list.filter((b) => b.id !== id));
  const move = (id: string, to: number) =>
    update((list) => {
      const from = list.findIndex((b) => b.id === id);
      if (from < 0) return list;
      const next = [...list];
      const [b] = next.splice(from, 1);
      next.splice(to > from ? to - 1 : to, 0, b);
      return next;
    });

  // Leaving with unsaved changes asks first. Saving (submitting the form) doesn't.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    const form = page.current?.closest("form");
    const saved = () => window.removeEventListener("beforeunload", warn);
    window.addEventListener("beforeunload", warn);
    form?.addEventListener("submit", saved);
    return () => {
      window.removeEventListener("beforeunload", warn);
      form?.removeEventListener("submit", saved);
    };
  }, [dirty]);

  /** Where a point on the screen falls between blocks (a position in the full list; `skip` is the block being moved). */
  const indexAt = (y: number, skip?: string) => {
    let i = 0;
    for (const b of items) {
      if (b.id === skip) continue;
      const r = refs.current.get(b.id)?.getBoundingClientRect();
      if (r && y > r.top + r.height / 2) i = items.indexOf(b) + 1;
    }
    return i;
  };

  const insertAt = (index: number, blocks: Item[]) =>
    update((list) => {
      const next = [...list];
      next.splice(index, 0, ...blocks);
      return next;
    });

  /** Index after the selected block, or the end. */
  const nextIndex = () => {
    const i = items.findIndex((b) => b.id === selected);
    return i < 0 ? items.length : i + 1;
  };

  const add = (b: Block) => {
    insertAt(nextIndex(), [b]);
    setSelected(b.id);
  };

  async function upload(files: File[], index: number) {
    setError("");
    const holders: Uploading[] = files.map((f) => ({
      id: newBlockId(),
      type: "uploading",
      name: f.name,
    }));
    insertAt(index, holders);
    await Promise.all(
      files.map(async (f, n) => {
        const fd = new FormData();
        fd.append("file", f);
        try {
          const res = await fetch("/api/plans/upload", {
            method: "POST",
            body: fd,
          });
          const data = (await res.json()) as {
            file?: string;
            name?: string;
            error?: string;
          };
          if (!res.ok || !data.file)
            throw new Error(data.error || `${f.name} didn't upload.`);
          const block = mediaBlock(data.file, data.name || f.name);
          setItems((list) =>
            list.map((b) => (b.id === holders[n].id ? block : b)),
          );
          setSelected(block.id);
        } catch (e) {
          setError(e instanceof Error ? e.message : `${f.name} didn't upload.`);
          setItems((list) => list.filter((b) => b.id !== holders[n].id));
        }
      }),
    );
  }

  // Dropping files from the computer adds them where they're dropped; pasting a picture adds it after the selected block.
  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setDropAt(indexAt(e.clientY));
  };
  const onDrop = (e: React.DragEvent) => {
    const files = [...e.dataTransfer.files];
    setDropAt(null);
    if (!files.length) return;
    e.preventDefault();
    upload(files, indexAt(e.clientY));
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const files = [...e.clipboardData.files];
    if (!files.length) return;
    e.preventDefault();
    upload(files, nextIndex());
  };

  // Moving a block: hold its handle and drag (mouse or finger).
  const startMove = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(id);
    setDrag({ id, to: items.findIndex((b) => b.id === id) });
  };
  const moving = (e: React.PointerEvent) => {
    if (!drag) return;
    if (e.clientY < 70) window.scrollBy(0, -12);
    else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 12);
    setDrag({ ...drag, to: indexAt(e.clientY, drag.id) });
  };
  const endMove = () => {
    if (drag) {
      const from = items.findIndex((b) => b.id === drag.id);
      if (drag.to !== from && drag.to !== from + 1) move(drag.id, drag.to);
    }
    setDrag(null);
  };

  const saved = items.filter((b): b is Block => b.type !== "uploading");
  // Where the moved block or dropped files will go (a position in the list).
  const marker = drag ? drag.to : dropAt;

  return (
    <div>
      <input type="hidden" name="blocks" value={JSON.stringify(saved)} />
      <Toolbar onAdd={add} onFiles={() => filePicker.current?.click()} />
      <input
        ref={filePicker}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) upload(files, nextIndex());
        }}
      />
      {error && (
        <p className="mb-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div
        ref={page}
        className={`plan-page plan-editor rounded-xl border border-border bg-surface p-4 sm:p-6 ${dropAt !== null ? "ring-2 ring-accent" : ""}`}
        onDragOver={onDragOver}
        onDragLeave={(e) => {
          if (!page.current?.contains(e.relatedTarget as Node)) setDropAt(null);
        }}
        onDrop={onDrop}
        onPaste={onPaste}
        onPointerMove={moving}
        onPointerUp={endMove}
        onPointerCancel={endMove}
      >
        {items.map((b, i) => (
          <BlockShell
            key={b.id}
            block={b}
            index={i}
            total={items.length}
            marker={marker === i}
            selected={selected === b.id}
            dragging={drag?.id === b.id}
            register={(el) =>
              el ? refs.current.set(b.id, el) : refs.current.delete(b.id)
            }
            onSelect={() => setSelected(b.id)}
            onGrip={(e) => startMove(e, b.id)}
            onUp={() => move(b.id, i - 1)}
            onDown={() => move(b.id, i + 2)}
            onRemove={() => remove(b.id)}
            onChange={(patch) => change(b.id, patch)}
            pageEl={page}
          />
        ))}
        {marker === items.length && <DropLine />}
        {items.length === 0 && (
          <p className="py-8 text-center text-muted">
            Add a heading, text, pictures or PDFs above, or drop files here.
          </p>
        )}
      </div>
      <p className="hint mt-2">
        Drag <span aria-hidden>⠿</span> to move a block. Drag a picture&apos;s
        corner to size it, and choose left or right to put text beside it. You
        can also drop pictures and PDFs onto the page, or paste a picture.
      </p>
    </div>
  );
}

function Toolbar({
  onAdd,
  onFiles,
}: {
  onAdd: (b: Block) => void;
  onFiles: () => void;
}) {
  return (
    <div id="add" className="sticky top-14 z-10 -mx-1 mb-3 flex scroll-mt-16 flex-wrap gap-2 bg-bg/90 px-1 py-2 backdrop-blur">
      <span className="self-center text-sm font-semibold text-muted">Add:</span>
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={() => onAdd({ id: newBlockId(), type: "heading", text: "" })}
      >
        Heading
      </button>
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={() => onAdd({ id: newBlockId(), type: "text", text: "" })}
      >
        Text
      </button>
      <button type="button" className="btn-primary btn-sm" onClick={onFiles}>
        Pictures or PDFs
      </button>
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={() => onAdd({ id: newBlockId(), type: "divider" })}
      >
        Divider
      </button>
    </div>
  );
}

function DropLine() {
  return (
    <div className="relative clear-both h-0" aria-hidden>
      <div className="absolute inset-x-0 -top-1 h-1 rounded bg-accent" />
    </div>
  );
}

function BlockShell(props: {
  block: Item;
  index: number;
  total: number;
  marker: boolean;
  selected: boolean;
  dragging: boolean;
  register: (el: HTMLElement | null) => void;
  onSelect: () => void;
  onGrip: (e: React.PointerEvent) => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  onChange: (patch: Partial<Block>) => void;
  pageEl: React.RefObject<HTMLDivElement | null>;
}) {
  const { block: b, selected } = props;
  const media = b.type === "image" || b.type === "pdf";
  const outer = media
    ? mediaProps(b)
    : { className: "plan-block-flow", style: undefined };
  const controls = (
    <BlockControls
      index={props.index}
      total={props.total}
      onGrip={props.onGrip}
      onUp={props.onUp}
      onDown={props.onDown}
      onRemove={props.onRemove}
    />
  );
  return (
    <>
      {props.marker && <DropLine />}
      <div
        ref={props.register}
        className={`${outer.className} plan-edit-block group relative ${selected ? "is-selected" : ""} ${props.dragging ? "opacity-40" : ""}`}
        style={outer.style}
        onFocusCapture={props.onSelect}
        onPointerDownCapture={props.onSelect}
      >
        {!media && <div className="plan-edit-controls">{controls}</div>}
        <BlockBody
          block={b}
          selected={selected}
          onChange={props.onChange}
          pageEl={props.pageEl}
          controls={controls}
        />
      </div>
    </>
  );
}

/** Move and remove buttons for one block. */
function BlockControls(props: {
  index: number;
  total: number;
  onGrip: (e: React.PointerEvent) => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className="plan-grip"
        onPointerDown={props.onGrip}
        aria-label="Drag to move"
        title="Drag to move"
      >
        ⠿
      </button>
      <button
        type="button"
        onClick={props.onUp}
        disabled={props.index === 0}
        aria-label="Move up"
        title="Move up"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={props.onDown}
        disabled={props.index === props.total - 1}
        aria-label="Move down"
        title="Move down"
      >
        ↓
      </button>
      <button
        type="button"
        onClick={props.onRemove}
        aria-label="Remove"
        title="Remove"
        className="text-danger"
      >
        ✕
      </button>
    </>
  );
}

function BlockBody({
  block: b,
  selected,
  onChange,
  pageEl,
  controls,
}: {
  block: Item;
  selected: boolean;
  onChange: (patch: Partial<Block>) => void;
  pageEl: React.RefObject<HTMLDivElement | null>;
  controls: React.ReactNode;
}) {
  switch (b.type) {
    case "uploading":
      return <div className="plan-pdf-loading">Uploading {b.name}…</div>;
    case "heading":
      return (
        <div>
          <div className="plan-text-tools">
            <SizePicker size={b.size} onChange={(size) => onChange({ size })} />
          </div>
          <input
            className={`plan-edit-heading ${sizeClass(b.size)}`}
            value={b.text}
            maxLength={200}
            placeholder="Heading"
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </div>
      );
    case "divider":
      return <hr />;
    case "text":
      return (
        <TextBlock text={b.text} size={b.size} onChange={(text) => onChange({ text })} onSize={(size) => onChange({ size })} />
      );
    case "image":
    case "pdf":
      return (
        <MediaEditor
          block={b}
          selected={selected}
          onChange={onChange}
          pageEl={pageEl}
          controls={controls}
        />
      );
  }
}

/** Text with a few formatting buttons (it's stored as simple Markdown). */
/** Small / Normal / Large / Extra large, for a text or heading block. */
function SizePicker({ size, onChange }: { size?: TextSize; onChange: (size: TextSize) => void }) {
  return (
    <select aria-label="Text size" title="Text size" className="plan-size-pick" value={size ?? "md"} onChange={(e) => onChange(e.target.value as TextSize)} data-native>
      {TEXT_SIZES.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

function TextBlock({
  text,
  size,
  onChange,
  onSize,
}: {
  text: string;
  size?: TextSize;
  onChange: (text: string) => void;
  onSize: (size: TextSize) => void;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [text]);
  const wrap = (before: string, after = before, placeholder = "text") => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const picked = text.slice(s, e) || placeholder;
    onChange(text.slice(0, s) + before + picked + after + text.slice(e));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(
        s + before.length,
        s + before.length + picked.length,
      );
    });
  };
  const bullets = () => {
    const el = area.current;
    if (!el) return;
    const s = text.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const e = text.indexOf("\n", el.selectionEnd);
    const end = e < 0 ? text.length : e;
    const lines = text
      .slice(s, end)
      .split("\n")
      .map((l) => (l.startsWith("- ") ? l.slice(2) : `- ${l}`));
    onChange(text.slice(0, s) + lines.join("\n") + text.slice(end));
  };
  return (
    <div>
      <div className="plan-text-tools">
        <button
          type="button"
          onClick={() => wrap("**")}
          title="Bold"
          className="font-bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => wrap("*")}
          title="Italic"
          className="italic"
        >
          I
        </button>
        <button type="button" onClick={bullets} title="Bulleted list">
          • List
        </button>
        <button
          type="button"
          onClick={() => wrap("[", "](https://)", "link text")}
          title="Link"
        >
          Link
        </button>
        <SizePicker size={size} onChange={onSize} />
      </div>
      <textarea
        ref={area}
        className={`plan-edit-text ${sizeClass(size)}`}
        value={text}
        rows={3}
        placeholder="Write here…"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function MediaEditor({
  block: b,
  selected,
  onChange,
  pageEl,
  controls,
}: {
  block: MediaBlock;
  selected: boolean;
  onChange: (patch: Partial<Block>) => void;
  pageEl: React.RefObject<HTMLDivElement | null>;
  controls: React.ReactNode;
}) {
  const src = `/files/${b.file}`;
  // Dragging the corner: width follows the pointer as a share of the page.
  const resize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const pageWidth = pageEl.current?.clientWidth || 600;
    const startX = e.clientX;
    const start = b.width;
    const dir = b.align === "right" ? -1 : b.align === "center" ? 2 : 1;
    const onMove = (ev: PointerEvent) => {
      const w =
        Math.round(
          (start + ((ev.clientX - startX) * dir * 100) / pageWidth) / 5,
        ) * 5;
      onChange({ width: Math.min(100, Math.max(MIN_WIDTH, w)) });
    };
    const done = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", done);
      handle.removeEventListener("pointercancel", done);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", done);
    handle.addEventListener("pointercancel", done);
  };
  return (
    <>
      {/* One toolbar floating above the picture, at its own width, so a small picture doesn't squeeze it. */}
      {selected && (
        <div
          className={`plan-media-tools ${b.align === "right" ? "right-0" : "left-0"}`}
        >
          {(["left", "center", "right"] as Align[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onChange({ align: a })}
              className={b.align === a ? "is-on" : ""}
              title={
                a === "center" ? "Centered" : `On the ${a}, text beside it`
              }
            >
              {a === "left" ? "◧ Left" : a === "right" ? "Right ◨" : "▣ Center"}
            </button>
          ))}
          <span className="mx-1 text-border">|</span>
          {SIZES.map(([label, w]) => (
            <button
              key={label}
              type="button"
              onClick={() => onChange({ width: w })}
              className={b.width === w ? "is-on" : ""}
            >
              {label}
            </button>
          ))}
          {b.type === "pdf" && b.file.endsWith(".pdf") && (
            <>
              <span className="mx-1 text-border">|</span>
              <button
                type="button"
                onClick={() => onChange({ pages: !b.pages })}
              >
                {b.pages ? "Show as a link" : "Show pages"}
              </button>
            </>
          )}
          <span className="mx-1 text-border">|</span>
          <span className="plan-media-moves">{controls}</span>
        </div>
      )}
      <div className="relative">
        {b.type === "image" && isPicture(b.file) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={b.caption || b.name} draggable={false} />
        ) : b.type === "pdf" && b.pages && b.file.endsWith(".pdf") ? (
          <PdfPages src={src} name={b.name} />
        ) : (
          <div className="plan-file-card">
            📄 <span>{b.name}</span>
          </div>
        )}
        <button
          type="button"
          className="plan-resize"
          onPointerDown={resize}
          aria-label="Drag to resize"
          title="Drag to resize"
        />
        {selected && <span className="plan-size-badge">{b.width}%</span>}
      </div>
      {(selected || b.caption) && (
        <input
          className="plan-edit-caption"
          value={b.caption}
          maxLength={300}
          placeholder="Caption (optional)"
          onChange={(e) => onChange({ caption: e.target.value })}
        />
      )}
    </>
  );
}
