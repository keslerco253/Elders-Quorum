"use client";

import { useEffect, useState } from "react";
import { FlyerThumb } from "./flyer-thumb";
import { UPLOAD_ACCEPT } from "@/lib/upload-names";

/** The flyer picker on event and service forms: a preview of the current flyer, and of a newly chosen picture. */
export function FlyerField({ file, name, hint }: { file?: string | null; name?: string | null; hint: string }) {
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview]);
  return (
    <div>
      <label className="label" htmlFor="flyer">
        Flyer (optional)
      </label>
      {file && !preview && (
        <div className="mb-2 flex items-center gap-3 text-sm">
          <a href={`/files/${file}`} target="_blank" rel="noreferrer" title="Open the flyer" className="flyer-field-thumb">
            <FlyerThumb file={file} name={name ?? null} big />
          </a>
          <div className="min-w-0">
            <div className="truncate">{name}</div>
            <label className="text-muted">
              <input type="checkbox" name="remove_flyer" /> remove
            </label>
          </div>
        </div>
      )}
      {preview && (
        <div className="mb-2 flex items-center gap-3 text-sm">
          {preview.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.url} alt="" className="flyer-field-thumb h-24 w-24 rounded-lg border border-border object-cover" />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-lg border border-border bg-surface-2 text-3xl">📄</span>
          )}
          <div className="min-w-0">
            <div className="truncate">{preview.name}</div>
            <div className="text-muted">{file ? "Replaces the current flyer when you save." : "Added when you save."}</div>
          </div>
        </div>
      )}
      <input
        id="flyer"
        name="flyer"
        type="file"
        accept={UPLOAD_ACCEPT}
        className="input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          // Phone photos (HEIC) don't preview in most browsers, so only common picture types get one.
          setPreview(f ? { name: f.name, url: /^image\/(png|jpe?g|gif|webp)$/.test(f.type) ? URL.createObjectURL(f) : "" } : null);
        }}
      />
      <p className="hint">{hint}</p>
    </div>
  );
}
