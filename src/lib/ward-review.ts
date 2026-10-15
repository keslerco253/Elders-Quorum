import { db } from "./db";
import { notify, recipientById } from "./notify";
import { deleteWard, getWard, homeOf, wardOrg } from "./orgs";
import { sendAccountNotice } from "./login-code";
import { appUrl } from "./config";
import { formatPhone } from "./contact";
import type { Member, Ward } from "./types";

// A ward someone starts is set up right away, but stays under review (nothing can be
// done in it and nothing is sent) until the site owner approves it.

export interface PendingWard extends Ward {
  created_at: string;
  creator: string | null;
  creator_contact: string | null;
  creator_id: number | null;
}

export function pendingWards(): PendingWard[] {
  return db()
    .prepare(
      `SELECT w.*, m.display_name AS creator, COALESCE(m.email, m.phone) AS creator_contact, m.id AS creator_id
       FROM wards w LEFT JOIN members m ON m.id = w.created_by WHERE w.pending = 1 ORDER BY w.created_at`,
    )
    .all() as PendingWard[];
}

const contactText = (c: string | null) => (c && !c.includes("@") ? formatPhone(c) : (c ?? ""));

/** Tells the site owner(s) a new ward is waiting for them. */
export async function tellOwnerAboutNewWard(wardId: number) {
  const w = pendingWards().find((x) => x.id === wardId);
  if (!w) return;
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase() ?? "";
  const owners = db().prepare("SELECT id FROM members WHERE status = 'active' AND (is_site_owner = 1 OR (lower(email) = ? AND email_verified_at IS NOT NULL))").all(ownerEmail) as { id: number }[];
  const recipients = owners.flatMap((o) => {
    const home = homeOf(o.id);
    const r = home.orgId ? recipientById(o.id, home.orgId) : undefined;
    return r ? [r] : [];
  });
  await notify(recipients, {
    title: "New ward to approve",
    body: `${w.creator ?? "Someone"} (${contactText(w.creator_contact)}) started ${w.name}${w.stake ? `, ${w.stake}` : ""}. Check it's real, then approve it.`,
    url: "/site#new-wards",
  });
}

/** Approves a ward: it opens, and whoever started it is told. */
export async function approveWard(wardId: number): Promise<PendingWard | null> {
  const w = pendingWards().find((x) => x.id === wardId);
  if (!w) return null;
  db().prepare("UPDATE wards SET pending = 0 WHERE id = ?").run(wardId);
  const creator = w.creator_id ? (db().prepare("SELECT * FROM members WHERE id = ?").get(w.creator_id) as Member | undefined) : undefined;
  if (creator) {
    await sendAccountNotice(
      creator,
      `${w.name} is approved`,
      `Hi ${creator.display_name},\n\n${w.name} is approved and ready to use. Sign in to share its join code and set up its organizations.`,
      { url: `${appUrl()}/?org=${wardOrg(wardId).id}`, label: "Open My Ward Link" },
    );
  }
  return w;
}

/** Declines a ward: it's deleted (with accounts only in it), and whoever started it is told. */
export async function declineWard(wardId: number, note: string): Promise<PendingWard | null> {
  const w = pendingWards().find((x) => x.id === wardId);
  if (!w || !getWard(wardId)) return null;
  const creator = w.creator_id ? (db().prepare("SELECT * FROM members WHERE id = ?").get(w.creator_id) as Member | undefined) : undefined;
  if (creator) {
    await sendAccountNotice(
      creator,
      `About ${w.name}`,
      `Hi ${creator.display_name},\n\nThanks for your interest in My Ward Link. We weren't able to approve ${w.name} at this time.${note ? `\n\n${note}` : ""}`,
      { url: appUrl(), label: "My Ward Link" },
    );
  }
  deleteWard(wardId);
  return w;
}
