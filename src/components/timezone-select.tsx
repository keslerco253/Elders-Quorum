const ZONES: [string, string][] = [
  ["America/Boise", "Mountain – Idaho"],
  ["America/Denver", "Mountain – Utah, Colorado"],
  ["America/Phoenix", "Mountain – Arizona (no daylight saving)"],
  ["America/Los_Angeles", "Pacific"],
  ["America/Chicago", "Central"],
  ["America/New_York", "Eastern"],
  ["America/Anchorage", "Alaska"],
  ["Pacific/Honolulu", "Hawaii"],
];

export function TimezoneSelect({ id, name, defaultValue }: { id?: string; name: string; defaultValue: string }) {
  const zones = ZONES.some(([z]) => z === defaultValue) ? ZONES : [...ZONES, [defaultValue, defaultValue] as [string, string]];
  return (
    <select id={id} name={name} defaultValue={defaultValue} className="input">
      {zones.map(([z, label]) => (
        <option key={z} value={z}>
          {label}
        </option>
      ))}
    </select>
  );
}
