"use client";

import { useEffect } from "react";
import { reloadIfStale } from "@/components/updated-reload";

/**
 * When a page or a save fails (the app being updated, a lost connection, something
 * too big to send): say so plainly instead of a blank error screen. What was being
 * typed in agenda and notes boxes is kept on this device and comes back after
 * trying again.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // The app was updated since the page opened: reload it (it then says to try again).
    if (!reloadIfStale(error))
      window.dispatchEvent(new Event("mwl-error-page"));
  }, [error]);
  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <div className="text-4xl" aria-hidden>
        ⚠️
      </div>
      <h1 className="h2 mt-3">That didn&apos;t go through</h1>
      <p className="mt-2 text-sm text-muted">
        Your last change may not have saved. The app may be updating, or the
        connection dropped. Wait a moment and try again. What you were writing
        in the agenda or notes is kept on this device.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            reset();
            history.back();
          }}
        >
          Go back
        </button>
      </div>
    </div>
  );
}
