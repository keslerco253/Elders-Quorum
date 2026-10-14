"use client";

import { useEffect, useRef } from "react";

/**
 * The 6-digit code box. Phones offer the code from a text above the keyboard
 * (Android can fill it in by itself), and the form sends as soon as all six
 * digits are in, so a tap on the suggestion signs you in.
 */
export function CodeInput({ id, className }: { id?: string; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);

  const sendIfComplete = () => {
    const el = ref.current;
    if (el && el.value.replace(/\D/g, "").length === 6) el.form?.requestSubmit();
  };

  useEffect(() => {
    if (!("OTPCredential" in window)) return;
    const ac = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: ac.signal } as CredentialRequestOptions)
      .then((cred) => {
        const code = (cred as { code?: string } | null)?.code;
        if (code && ref.current && !ref.current.value) {
          ref.current.value = code;
          sendIfComplete();
        }
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  return (
    <input
      ref={ref}
      id={id}
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      pattern="[0-9 ]{6,7}"
      maxLength={7}
      required
      className={className}
      onInput={sendIfComplete}
    />
  );
}
