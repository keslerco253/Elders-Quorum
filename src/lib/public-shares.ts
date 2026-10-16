import crypto from "crypto";
import QRCode from "qrcode";
import { db } from "./db";
import { appUrl } from "./config";
import { blockFiles, versionBlocks } from "./plan-blocks";
import { currentVersion } from "./plans";

// Public links (and their QR codes) to one thing, for people without an account:
// a single picture or PDF, or one service opportunity they can sign up for.
// Nothing else in the app is reachable from them.

export interface PublicShare {
  token: string;
  org_id: number;
  kind: "file" | "signup" | "plan";
  file: string | null;
  signup_id: number | null;
  plan_id: number | null;
  title: string;
  caption: string;
  created_by: number | null;
  created_by_name?: string | null;
  created_at: string;
}

export const shareUrl = (token: string) => `${appUrl()}/p/${token}`;

export function shareQrSvg(token: string): Promise<string> {
  return QRCode.toString(shareUrl(token), { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
}

export function sharePng(token: string): Promise<Buffer> {
  return QRCode.toBuffer(shareUrl(token), { type: "png", margin: 2, width: 1024, errorCorrectionLevel: "M" });
}

export function createShare(s: { orgId: number; kind: "file" | "signup" | "plan"; file?: string | null; signupId?: number | null; planId?: number | null; title: string; caption: string; createdBy: number }): string {
  // 12 random characters: links can't be guessed.
  const token = crypto.randomBytes(9).toString("base64url");
  db()
    .prepare("INSERT INTO public_shares (token, org_id, kind, file, signup_id, plan_id, title, caption, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(token, s.orgId, s.kind, s.file ?? null, s.signupId ?? null, s.planId ?? null, s.title.slice(0, 120), s.caption.slice(0, 500), s.createdBy);
  return token;
}

export function getShare(token: string): PublicShare | undefined {
  if (!/^[\w-]{6,40}$/.test(token)) return undefined;
  return db().prepare("SELECT * FROM public_shares WHERE token = ?").get(token) as PublicShare | undefined;
}

export function orgShares(orgId: number): PublicShare[] {
  return db()
    .prepare("SELECT s.*, m.display_name AS created_by_name FROM public_shares s LEFT JOIN members m ON m.id = s.created_by WHERE s.org_id = ? ORDER BY s.created_at DESC")
    .all(orgId) as PublicShare[];
}

/** Shares already made of this file or service opportunity (so the page can show them instead of making another). */
export function sharesOf(orgId: number, what: { file?: string; signupId?: number; planId?: number }): PublicShare[] {
  if (what.planId) return db().prepare("SELECT * FROM public_shares WHERE org_id = ? AND kind = 'plan' AND plan_id = ?").all(orgId, what.planId) as PublicShare[];
  return what.file
    ? (db().prepare("SELECT * FROM public_shares WHERE org_id = ? AND kind = 'file' AND file = ?").all(orgId, what.file) as PublicShare[])
    : (db().prepare("SELECT * FROM public_shares WHERE org_id = ? AND kind = 'signup' AND signup_id = ?").all(orgId, what.signupId ?? 0) as PublicShare[]);
}

export function stopShare(orgId: number, token: string): boolean {
  return db().prepare("DELETE FROM public_shares WHERE token = ? AND org_id = ?").run(token, orgId).changes > 0;
}

/** The pictures and PDFs on a plan's current version (what a shared plan page may show). */
export function sharedPlanFiles(planId: number): string[] {
  const v = currentVersion(planId);
  return v ? blockFiles(versionBlocks(v)) : [];
}

export function planShareContent(planId: number) {
  const v = currentVersion(planId);
  return v ? { title: v.title, blocks: versionBlocks(v), updated: v.created_at } : null;
}
