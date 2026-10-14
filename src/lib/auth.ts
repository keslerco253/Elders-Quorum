import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isHttps } from "./config";
import { createSession, deleteSession, userForSession, type Remember } from "./auth-core";
import { isAdmin, isPresidency } from "./permissions";
import type { CurrentUser } from "./types";
import { ORG_COOKIE } from "./orgs";

const COOKIE = "eq_session";

export const getUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  return userForSession(jar.get(COOKIE)?.value, Number(jar.get(ORG_COOKIE)?.value) || undefined);
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  // Members the presidency added see the welcome screen (what the app keeps, text consent) first.
  if (!user.welcomed_at) redirect("/welcome");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/");
  return user;
}

/** The bishopric (or whoever created the ward): ward settings, join code, organizations. */
export async function requireWardLeader(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.wardLeader) redirect("/");
  return user;
}

export async function requirePresidency(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isPresidency(user)) redirect("/");
  return user;
}

export async function startSession(memberId: number, remember: Remember) {
  const ua = (await headers()).get("user-agent");
  const { id, expires } = createSession(memberId, remember, ua);
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(),
    path: "/",
    // "session" leaves out an expiry so the browser drops it when closed.
    ...(remember === "session" ? {} : { expires }),
  });
}

export async function endSession() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) deleteSession(id);
  jar.delete(COOKIE);
}
