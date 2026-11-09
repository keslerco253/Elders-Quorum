/**
 * A text link for the phone's own Messages app, with the numbers and words filled in.
 * iPhones and Android phones write it differently, and a group differently from one person.
 */
export function smsHref(phones: string[], body: string, apple: boolean): string {
  const words = encodeURIComponent(body);
  if (apple) return phones.length > 1 ? `sms:/open?addresses=${phones.join(",")}&body=${words}` : `sms:${phones[0]}&body=${words}`;
  return `sms:${phones.join(",")}?body=${words}`;
}
