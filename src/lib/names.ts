const TITLES = new Set(["brother", "bro", "sister", "sis", "elder", "bishop", "president", "pres"]);

/** "Brother Sam Jones" -> "Sam": the first word that isn't a title. */
export function firstName(displayName: string) {
  const words = displayName.trim().split(/\s+/);
  return words.find((w) => !TITLES.has(w.toLowerCase().replace(/\.$/, ""))) ?? words[0] ?? "";
}
