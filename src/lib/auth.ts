import "server-only";
import { endJournalSession } from "./journal-session";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasAdminTab } from "./admin-counts";
import { cache } from "react";
import { isHttps } from "./config";
import { createSession, deleteSession, userForSession, type Remember } from "./auth-core";
import { isAdmin, isPresidency } from "./permissions";
import { FEATURES, type CurrentUser, type Feature } from "./types";
import { ORG_COOKIE, parseOrgCookie } from "./org-cookie";
import { hasFeature, ledOrgsAnywhere } from "./orgs";

const COOKIE = "eq_session";

export const getUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  return userForSession(jar.get(COOKIE)?.value, parseOrgCookie(jar.get(ORG_COOKIE)?.value));
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  // Members the presidency added see the welcome screen (what the app keeps, text consent) first.
  if (!user.welcomed_at) redirect("/welcome");
  // A new ward waits for the site owner's approval before anything can be done in it.
  if (user.ward.pending && !user.is_site_owner) redirect("/review");
  return user;
}

/** Someone who leads another organization is shown where to switch, instead of the home page. */
function notALeaderHere(user: CurrentUser): never {
  redirect(ledOrgsAnywhere(user.id).length ? "/leader" : "/");
}

/**
 * The Admin tab: an organization's leaders, plus ward administrators, the site owner
 * and the ward's backup person (with messages to pass on), for their own tools there.
 */
export async function requireAdminTab(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isAdmin(user) && !hasAdminTab(user)) notALeaderHere(user);
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isAdmin(user)) notALeaderHere(user);
  return user;
}

/** Ward administrators (or the site owner): ward settings, join code, organizations. */
export async function requireWardAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.wardAdmin) redirect("/");
  return user;
}

export async function requirePresidency(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isPresidency(user)) notALeaderHere(user);
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
  // An unlocked journal locks again too.
  await endJournalSession();
}

/** Leaders' pages for an optional feature: when it's turned off, go to Settings, which says so. */
export function requireFeature(user: CurrentUser, f: Feature) {
  if (!hasFeature(user.org, f)) redirect(`/admin/settings?msg=${encodeURIComponent(`"${FEATURES[f]}" is turned off for ${user.orgLabel}. Turn it on below to use it.`)}`);
}
