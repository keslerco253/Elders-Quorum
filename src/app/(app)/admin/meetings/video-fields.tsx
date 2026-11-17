import { videoKind } from "@/lib/meetings";

/**
 * "Meet over video" on a meeting form: on or off, and (optional) a link just for this
 * meeting; empty uses the presidency's saved link.
 */
export function VideoMeetingFields({ on, link, saved, className = "" }: { on: boolean; link: string | null; saved: string | null; className?: string }) {
  const kind = saved ? videoKind(saved) : "Zoom";
  return (
    <div className={`space-y-1.5 ${className}`}>
      <input type="hidden" name="video_fields" value="1" />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="video" defaultChecked={on} className="mt-1" />
        <span>
          <strong>Meet on {kind}</strong>
          <span className="block text-muted">Everyone in it gets a Join button: on the calendar, in its reminder, and when it starts.</span>
        </span>
      </label>
      <details open={!!link || !saved} className="ml-6 text-sm">
        <summary className="cursor-pointer text-accent">{saved ? "Use a different link for this meeting" : "Its link"}</summary>
        <input name="video_link" type="url" defaultValue={link ?? ""} className="input mt-1" placeholder="https://us02web.zoom.us/j/1234567890?pwd=…" aria-label="Link for this meeting" />
        <p className="hint">{saved ? "Leave it empty to use your saved link." : "No link is saved for your presidency yet: paste one here, or save one under Video meeting."}</p>
      </details>
    </div>
  );
}
