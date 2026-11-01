import { AGENDA_SECTIONS } from "@/lib/agenda-sections";

/** Which agenda section a new item goes under (Presidency business unless another is chosen). */
export function SectionSelect({ className = "" }: { className?: string }) {
  return (
    <select name="section" defaultValue="presidency" className={`input ${className}`} aria-label="Section">
      {AGENDA_SECTIONS.map(([k, label]) => (
        <option key={k} value={k}>
          {label}
        </option>
      ))}
    </select>
  );
}
