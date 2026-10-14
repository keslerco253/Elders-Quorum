import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/config";
import { ORG_COOKIE, orgCookieMaxAge } from "@/lib/org-cookie";

/**
 * After the app moves to another server, set MOVED_TO=https://new-address on
 * the old one: every page and link sends people to the same page there.
 * Also sends www.<address> to the address itself, so sign-ins and forms work,
 * and shows visitors who aren't signed in the home page (/about) at "/".
 */
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname + req.nextUrl.search;
  const moved = process.env.MOVED_TO?.trim().replace(/\/+$/, "");
  const to = moved && !/^https?:\/\//i.test(moved) ? `https://${moved}` : moved;
  if (to && req.nextUrl.pathname !== "/api/health") return NextResponse.redirect(to + path, 308);
  const app = appAddress();
  if (app && req.headers.get("host") === "www." + app.host) return NextResponse.redirect(app.origin + path, 308);
  // ?org=<id> (from notifications and links between organizations) switches
  // to that organization, then shows the same page without it.
  const org = req.nextUrl.searchParams.get("org");
  if (org && /^\d+$/.test(org) && req.method === "GET") {
    const url = req.nextUrl.clone();
    url.searchParams.delete("org");
    const res = NextResponse.redirect(url, 303);
    res.cookies.set(ORG_COOKIE, org, { path: "/", maxAge: orgCookieMaxAge, sameSite: "lax", httpOnly: true, secure: url.protocol === "https:" });
    return res;
  }
  // Visitors who aren't signed in see the home page that explains the app;
  // in the phone app (which says so in its user agent) they go to sign in.
  if (req.nextUrl.pathname === "/" && !req.cookies.has("eq_session")) {
    if (req.headers.get("user-agent")?.includes("MyWardLinkApp")) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url, 307);
    }
    const url = req.nextUrl.clone();
    url.pathname = "/about";
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

function appAddress() {
  try {
    return process.env.APP_URL ? new URL(appUrl()) : undefined;
  } catch {
    return undefined;
  }
}

export const config = { runtime: "nodejs" };
