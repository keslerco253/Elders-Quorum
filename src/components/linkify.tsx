import { Fragment } from "react";

// Web addresses, email addresses and US phone numbers in a message.
const PATTERN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]|www\.[^\s<]+[^\s<.,;:!?)\]'"]|[\w.+-]+@[\w-]+\.[\w.-]+[a-z]|(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/gi;

function href(match: string): string {
  if (/^https?:\/\//i.test(match)) return match;
  if (/^www\./i.test(match)) return `https://${match}`;
  if (match.includes("@")) return `mailto:${match}`;
  return `tel:${match.replace(/[^\d+]/g, "")}`;
}

/** Message text with tappable links, emails and phone numbers, like a texting app. */
export function Linkify({ text }: { text: string }) {
  const parts = text.split(PATTERN);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={href(part)} className="underline underline-offset-2" target={/^(https?:|www\.)/i.test(part) ? "_blank" : undefined} rel="noreferrer">
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
