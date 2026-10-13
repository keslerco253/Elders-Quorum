// Phone numbers and emails as members type them.

export type ContactKind = "phone" | "email";
export type ContactPref = "text" | "email" | "both" | "none";

/** US-style numbers become +1XXXXXXXXXX; numbers typed with + keep their country code. */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function normalizeEmailAddress(input: string): string | null {
  const e = input.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** Works out whether someone typed a phone number or an email. */
export function parseContact(input: string): { kind: ContactKind; value: string } | null {
  if (input.includes("@")) {
    const v = normalizeEmailAddress(input);
    return v ? { kind: "email", value: v } : null;
  }
  const p = normalizePhone(input);
  return p ? { kind: "phone", value: p } : null;
}

/** +12085550142 -> (208) 555-0142 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const m = phone.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : phone;
}

export function formatContact(kind: ContactKind, value: string) {
  return kind === "phone" ? formatPhone(value) : value;
}

/** How to reach someone whose devices didn't get a push notification. */
export function fallbackChannels(r: { email: string | null; phone: string | null; contact_pref: ContactPref }, smsAvailable: boolean): ("email" | "text")[] {
  const canText = !!r.phone && smsAvailable;
  const canEmail = !!r.email;
  switch (r.contact_pref) {
    case "none":
      return [];
    case "both":
      return [...(canEmail ? (["email"] as const) : []), ...(canText ? (["text"] as const) : [])];
    case "text":
      return canText ? ["text"] : canEmail ? ["email"] : [];
    case "email":
    default:
      return canEmail ? ["email"] : canText ? ["text"] : [];
  }
}
