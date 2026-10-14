import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/config";

/**
 * After the app moves to another server, set MOVED_TO=https://new-address on
 * the old one: every page and link sends people to the same page there.
 * Also sends www.<address> to the address itself, so sign-ins and forms work.
 */
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname + req.nextUrl.search;
  const moved = process.env.MOVED_TO?.trim().replace(/\/+$/, "");
  const to = moved && !/^https?:\/\//i.test(moved) ? `https://${moved}` : moved;
  if (to && req.nextUrl.pathname !== "/api/health") return NextResponse.redirect(to + path, 308);
  const app = appAddress();
  if (app && req.headers.get("host") === "www." + app.host) return NextResponse.redirect(app.origin + path, 308);
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
