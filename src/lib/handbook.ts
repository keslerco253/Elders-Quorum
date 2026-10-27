import type { Org } from "./types";

// Quick links to the General Handbook (the Church's site, or Gospel Library if it's
// installed). Each chapter's page is /study/manual/general-handbook/<its page name>:
// most are "<number>-<name>" (e.g. 8-elders-quorum); a few are just the number. A
// wrong name opens the start of the handbook instead of the chapter.

export interface HandbookChapter {
  number: number;
  title: string;
  /** The chapter's page name on the Church's site. */
  page: string;
}

export const handbookUrl = (c: HandbookChapter) => `https://www.churchofjesuschrist.org/study/manual/general-handbook/${c.page}?lang=eng`;

export const BISHOPRIC: HandbookChapter = { number: 7, title: "The Bishopric", page: "7" };
export const TEACHING: HandbookChapter = { number: 17, title: "Teaching the Gospel", page: "17-teaching-the-gospel" };
export const ACTIVITIES: HandbookChapter = { number: 20, title: "Activities", page: "20-activities" };
export const MINISTERING: HandbookChapter = { number: 21, title: "Ministering", page: "21-ministering" };
export const TEMPORAL_NEEDS: HandbookChapter = { number: 22, title: "Providing for Temporal Needs and Building Self-Reliance", page: "22-providing-for-temporal-needs" };
export const NEW_MEMBERS: HandbookChapter = { number: 23, title: "Sharing the Gospel and Strengthening New and Returning Members", page: "23" };
export const MEETINGS: HandbookChapter = { number: 29, title: "Meetings in the Church", page: "29-meetings-in-the-church" };
export const CALLINGS: HandbookChapter = { number: 30, title: "Callings in the Church", page: "30-callings-in-the-church" };
export const INTERVIEWS: HandbookChapter = { number: 31, title: "Interviews and Other Meetings with Members", page: "31" };
export const RECORDS: HandbookChapter = { number: 33, title: "Records and Reports", page: "33-records-and-reports" };

const ORG_CHAPTERS: Record<string, HandbookChapter> = {
  "elders quorum": { number: 8, title: "Elders Quorum", page: "8-elders-quorum" },
  "relief society": { number: 9, title: "Relief Society", page: "9-relief-society" },
  "young men": { number: 10, title: "Aaronic Priesthood", page: "10-aaronic-priesthood" },
  "young women": { number: 11, title: "Young Women", page: "11-young-women" },
  primary: { number: 12, title: "Primary", page: "12-primary" },
  "sunday school": { number: 13, title: "Sunday School", page: "13-sunday-school" },
};

/** The chapter for an organization's leaders (the bishopric's for the ward), if it has one. */
export function orgChapter(org: Pick<Org, "kind" | "name">): HandbookChapter | undefined {
  if (org.kind === "ward") return BISHOPRIC;
  return ORG_CHAPTERS[org.name.trim().toLowerCase()];
}
