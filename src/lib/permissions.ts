import type { Role } from "./types";

type Who = { role: Role } | null | undefined;

/** In the organization being viewed: its presidency and admins. Posting, moderation, calendar, messages. */
export const isAdmin = (m: Who) => m?.role === "admin" || m?.role === "presidency";

/** The organization's presidency (the bishopric for the ward): visits, to-dos, members, teachers, roles. */
export const isPresidency = (m: Who) => m?.role === "presidency";
