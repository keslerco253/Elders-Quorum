import type { Member } from "./types";

type Who = Pick<Member, "role"> | null | undefined;

/** Presidency, bishop and Stake High Council representative: posting, moderation, calendar, messages. */
export const isAdmin = (m: Who) => m?.role === "admin" || m?.role === "presidency";

/** Presidency only: home visits, to-dos, access approval, teacher assignment, roles. */
export const isPresidency = (m: Who) => m?.role === "presidency";
