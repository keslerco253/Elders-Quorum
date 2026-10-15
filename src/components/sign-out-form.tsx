"use client";

import { useRef, type ReactNode } from "react";

/**
 * Signing out also stops this browser's notifications, so the next person to use
 * it (a shared family or library computer) doesn't get this member's messages.
 */
export function SignOutForm({ action, className, children }: { action: (fd: FormData) => Promise<void>; className?: string; children: ReactNode }) {
  const ready = useRef(false);
  return (
    <form
      action={action}
      className={className}
      onSubmit={async (e) => {
        if (ready.current) return;
        e.preventDefault();
        const form = e.currentTarget;
        try {
          const reg = await navigator.serviceWorker?.getRegistration();
          const sub = await reg?.pushManager.getSubscription();
          if (sub) {
            (form.elements.namedItem("push_endpoint") as HTMLInputElement).value = sub.endpoint;
            await sub.unsubscribe();
          }
        } catch {
          // Notifications aren't available here; sign out anyway.
        }
        ready.current = true;
        form.requestSubmit();
      }}
    >
      <input type="hidden" name="push_endpoint" />
      {children}
    </form>
  );
}
