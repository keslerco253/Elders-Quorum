/**
 * A text link for the phone's own Messages app, with the numbers and words filled in.
 * iPhones and Android phones write it differently, and a group differently from one person.
 */
export function smsHref(phones: string[], body: string, apple: boolean): string {
  const words = encodeURIComponent(body);
  if (apple) return phones.length > 1 ? `sms:/open?addresses=${phones.join(",")}&body=${words}` : `sms:${phones[0]}&body=${words}`;
  return `sms:${phones.join(",")}?body=${words}`;
}

/**
 * The text for one person: "Hyrum, see you tonight." when starting with their first
 * name (the message's first letter made small, unless it starts with "I", an
 * abbreviation, or someone's name), then the link on its own line.
 */
export function personalText(body: string, opts: { first?: string; link?: string; names?: string[] }): string {
  let text = body.trim();
  if (opts.first && text) {
    const word = text.split(/[\s,.!?]/)[0];
    const keep = /^I(\b|')/.test(text) || (word.length > 1 && word === word.toUpperCase()) || (opts.names ?? []).includes(word);
    text = `${opts.first}, ${keep ? text : text[0].toLowerCase() + text.slice(1)}`;
  } else if (opts.first) text = `${opts.first},`;
  return opts.link ? `${text}${text ? "\n" : ""}${opts.link}` : text;
}
