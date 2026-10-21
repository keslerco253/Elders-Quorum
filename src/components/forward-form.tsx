import { SubmitButton } from "./client";

/** "Forward…": send a member's message on to another organization or one leader. */
export function ForwardForm({
  messageId,
  targets,
  action,
  back,
  open,
}: {
  messageId: number;
  targets: { value: string; label: string }[];
  action: (fd: FormData) => void;
  back: string;
  open?: boolean;
}) {
  if (!targets.length) return null;
  return (
    <details className="mt-1 text-xs" open={open}>
      <summary className="cursor-pointer text-accent">Forward…</summary>
      <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="message_id" value={messageId} />
        <input type="hidden" name="back" value={back} />
        <select name="target" className="input min-w-0 flex-1 text-sm" aria-label="Forward to">
          {targets.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <SubmitButton className="btn-secondary btn-sm" pendingText="Forwarding…">
          Forward
        </SubmitButton>
      </form>
    </details>
  );
}
