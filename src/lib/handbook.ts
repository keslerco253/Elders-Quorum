import type { Org } from "./types";

// Quick links to the General Handbook (the Church's site, or Gospel Library if it's
// installed). Chapter pages are /study/manual/general-handbook/<number>.

export interface HandbookChapter {
  number: number;
  title: string;
}

export const handbookUrl = (c: HandbookChapter) => `https://www.churchofjesuschrist.org/study/manual/general-handbook/${c.number}?lang=eng`;

export const TEACHING: HandbookChapter = { number: 17, title: "Teaching the Gospel" };

const ORG_CHAPTERS: Record<string, HandbookChapter> = {
  "elders quorum": { number: 8, title: "Elders Quorum" },
  "relief society": { number: 9, title: "Relief Society" },
  "young men": { number: 10, title: "Aaronic Priesthood" },
  "young women": { number: 11, title: "Young Women" },
  primary: { number: 12, title: "Primary" },
  "sunday school": { number: 13, title: "Sunday School" },
};

/** The chapter for an organization's leaders (the bishopric's for the ward), if it has one. */
export function orgChapter(org: Pick<Org, "kind" | "name">): HandbookChapter | undefined {
  if (org.kind === "ward") return { number: 7, title: "The Bishopric" };
  return ORG_CHAPTERS[org.name.trim().toLowerCase()];
}
