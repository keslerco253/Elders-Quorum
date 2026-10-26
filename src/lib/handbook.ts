import type { Org } from "./types";

// Quick links to the General Handbook (the Church's site, or Gospel Library if it's
// installed). Chapter pages are /study/manual/general-handbook/<number>.

export interface HandbookChapter {
  number: number;
  title: string;
}

export const handbookUrl = (c: HandbookChapter) => `https://www.churchofjesuschrist.org/study/manual/general-handbook/${c.number}?lang=eng`;

export const BISHOPRIC: HandbookChapter = { number: 7, title: "The Bishopric" };
export const TEACHING: HandbookChapter = { number: 17, title: "Teaching the Gospel" };
export const ACTIVITIES: HandbookChapter = { number: 20, title: "Activities" };
export const MINISTERING: HandbookChapter = { number: 21, title: "Ministering" };
export const TEMPORAL_NEEDS: HandbookChapter = { number: 22, title: "Providing for Temporal Needs and Building Self-Reliance" };
export const NEW_MEMBERS: HandbookChapter = { number: 23, title: "Sharing the Gospel and Strengthening New and Returning Members" };
export const MEETINGS: HandbookChapter = { number: 29, title: "Meetings in the Church" };
export const CALLINGS: HandbookChapter = { number: 30, title: "Callings in the Church" };
export const INTERVIEWS: HandbookChapter = { number: 31, title: "Interviews and Other Meetings with Members" };
export const RECORDS: HandbookChapter = { number: 33, title: "Records and Reports" };

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
  if (org.kind === "ward") return BISHOPRIC;
  return ORG_CHAPTERS[org.name.trim().toLowerCase()];
}
