"use client";

import { useEffect, useRef, useState } from "react";
import { inviteMessage } from "@/lib/invite-text";

/**
 * The personal invitation text. It's rewritten as the date, time and "who's
 * going" boxes change, until the presidency member edits it themselves.
 */
export function InviteMessage({ members, presidency, leaders }: { members: { id: number; first: string }[]; presidency: { id: number; name: string }[]; leaders: string }) {
  const [text, setText] = useState("");
  const edited = useRef(false);

  useEffect(() => {
    const form = document.getElementById("plan-form");
    if (!form) return;
    const rebuild = (e?: Event) => {
      // Typing in the message itself must not rewrite it.
      if (edited.current || (e?.target as HTMLElement | null)?.getAttribute?.("name") === "invite_message") return;
      const date = (document.getElementById("date") as HTMLInputElement | null)?.value ?? "";
      const time = (document.getElementById("time") as HTMLInputElement | null)?.value || null;
      const memberId = Number((form.querySelector('[name="member_id"]') as HTMLInputElement | HTMLSelectElement | null)?.value);
      const firstName = members.find((m) => m.id === memberId)?.first ?? "there";
      const going = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="visitor_id"]:checked')).map((i) => presidency.find((p) => p.id === Number(i.value))?.name ?? "");
      setText(inviteMessage(firstName, date, time, going.filter(Boolean), leaders));
    };
    rebuild();
    form.addEventListener("input", rebuild);
    form.addEventListener("change", rebuild);
    return () => {
      form.removeEventListener("input", rebuild);
      form.removeEventListener("change", rebuild);
    };
  }, [members, presidency, leaders]);

  return (
    <div>
      <textarea
        name="invite_message"
        rows={5}
        maxLength={1000}
        className="input"
        value={text}
        onChange={(e) => {
          edited.current = true;
          setText(e.target.value);
        }}
      />
      <p className="hint">Written for you from the date, time and who&apos;s going. Change anything you like; then it stays as you wrote it.</p>
    </div>
  );
}
