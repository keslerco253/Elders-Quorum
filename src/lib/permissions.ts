import type { Role } from "./types";

type Who = { role: Role } | null | undefined;

/** Admin tools are for an organization's leadership (its presidency or bishopric, with secretaries and clerks). */
export const isAdmin = (m: Who) => m?.role === "presidency";

/** The organization's presidency (the bishopric for the ward): visits, to-dos, members, teachers, roles. */
export const isPresidency = (m: Who) => m?.role === "presidency";
