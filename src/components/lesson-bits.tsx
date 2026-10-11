import { DateTime } from "luxon";
import type { LessonKind } from "@/lib/types";

export function DateChip({ date, highlight }: { date: string; highlight?: boolean }) {
  const d = DateTime.fromISO(date);
  return (
    <div className={`flex w-14 shrink-0 flex-col items-center rounded-lg py-1.5 ${highlight ? "bg-primary text-primary-text" : "bg-surface-2 text-text"}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{d.toFormat("LLL")}</span>
      <span className="text-xl leading-6 font-bold">{d.toFormat("d")}</span>
    </div>
  );
}

export function conferenceLabel(kind: LessonKind) {
  return kind === "general_conference" ? "General Conference" : kind === "stake_conference" ? "Stake Conference" : null;
}
