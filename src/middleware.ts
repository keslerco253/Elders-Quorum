import { NextResponse, type NextRequest } from "next/server";

/**
 * After the app moves to another server, set MOVED_TO=https://new-address on
 * the old one: every page and link sends people to the same page there.
 */
export function middleware(req: NextRequest) {
  const to = process.env.MOVED_TO?.replace(/\/$/, "");
  if (!to || req.nextUrl.pathname === "/api/health") return NextResponse.next();
  return NextResponse.redirect(to + req.nextUrl.pathname + req.nextUrl.search, 308);
}

export const config = { runtime: "nodejs" };
