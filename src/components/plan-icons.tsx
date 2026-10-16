// Drawn icons for the ward's standing plans (the same on every phone and computer).

/** A temple on a sky-blue tile: white building, tall spire, a gold figure at the top. */
export function TempleIcon({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="11" fill="#dbeafe" />
      {/* Gold figure atop the spire */}
      <circle cx="24" cy="4.6" r="1.6" fill="#ca8a04" />
      <path d="M22.9 6h2.2l.5 3.2h-3.2z" fill="#ca8a04" />
      {/* Spire and tower */}
      <path d="M24 9 26.6 18h-5.2z" fill="#ffffff" stroke="#64748b" strokeWidth=".8" strokeLinejoin="round" />
      <rect x="20.5" y="18" width="7" height="6" fill="#ffffff" stroke="#64748b" strokeWidth=".8" />
      <rect x="18" y="24" width="12" height="5" fill="#ffffff" stroke="#64748b" strokeWidth=".8" />
      {/* Main building and wings */}
      <rect x="9" y="29" width="30" height="12" fill="#ffffff" stroke="#64748b" strokeWidth=".8" />
      <rect x="5" y="32" width="5" height="9" fill="#ffffff" stroke="#64748b" strokeWidth=".8" />
      <rect x="38" y="32" width="5" height="9" fill="#ffffff" stroke="#64748b" strokeWidth=".8" />
      {/* Arched windows and door */}
      {[12.5, 17.5, 28, 33].map((x) => (
        <path key={x} d={`M${x} 38.5v-5a1.25 1.25 0 0 1 2.5 0v5z`} fill="#60a5fa" />
      ))}
      <path d="M22 41v-6a2 2 0 0 1 4 0v6z" fill="#475569" />
      {/* Grounds */}
      <rect x="3" y="41" width="42" height="3.5" rx="1.5" fill="#4ade80" />
    </svg>
  );
}

/** Two missionaries on a warm tile: dark suits, white shirts, ties and black name tags. */
export function MissionariesIcon({ className = "h-12 w-12" }: { className?: string }) {
  const one = (x: number, tie: string) => (
    <g key={x} transform={`translate(${x} 0)`}>
      <circle cx="9" cy="14" r="5.2" fill="#1e293b" />
      <path d="M0 46V33a9 9 0 0 1 18 0v13z" fill="#1e293b" />
      <path d="M5.6 24.5h6.8L11.8 46H6.2z" fill="#ffffff" />
      <path d="M8 25h2l.6 2-1.6 12-1.6-12z" fill={tie} />
      <rect x="11.6" y="29" width="5" height="2.4" rx=".4" fill="#0f172a" stroke="#ffffff" strokeWidth=".5" />
    </g>
  );
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="11" fill="#fef3c7" />
      <svg x="3" y="0" width="42" height="48" viewBox="0 0 42 48" overflow="hidden">
        {one(2, "#2563eb")}
        {one(22, "#dc2626")}
      </svg>
    </svg>
  );
}

/** A plan's icon wherever plans are listed: its uploaded picture, a drawn icon, or an emoji. */
export function PlanIconView({ icon, className = "h-12 w-12" }: { icon: { file: string } | { key: string }; className?: string }) {
  if ("file" in icon) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/files/${icon.file}`} alt="" className={`${className} rounded-[11px] object-cover`} />;
  }
  if (icon.key === "temple") return <TempleIcon className={className} />;
  if (icon.key === "missionaries") return <MissionariesIcon className={className} />;
  return <span className={`${className} inline-flex items-center justify-center rounded-[11px] bg-surface-2 text-3xl`}>{icon.key}</span>;
}
