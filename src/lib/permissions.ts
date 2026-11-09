import type { Role } from "./types";

type Who = { role: Role } | null | undefined;

/** Admin tools are for an organization's leadership (its presidency or bishopric, with secretaries and clerks). */
export const isAdmin = (m: Who) => m?.role === "presidency";

/** The organization's presidency (the bishopric for the ward): visits, to-dos, members, teachers, roles. */
export const isPresidency = (m: Who) => m?.role === "presidency";

/**
 * Who manages the people of the organization they're looking at (its member list,
 * adding, organizations, turning accounts off, removing): its presidency, or (at the
 * ward level) the ward's administrators, who aren't the bishopric and so don't get
 * its messages, notices or leader tools.
 */
export const managesPeople = (u: { role: Role; wardAdmin: boolean; org: { kind: string } }) => u.role === "presidency" || (u.org.kind === "ward" && u.wardAdmin);
