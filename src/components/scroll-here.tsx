"use client";

import { useEffect, useRef } from "react";

/** Brings the spot it's in into view when the page opens (after something moved there). */
export function ScrollHere() {
  const here = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    // After the page has settled (moving to a page scrolls it too).
    const t = setTimeout(
      () => here.current?.parentElement?.scrollIntoView({ block: "center" }),
      150,
    );
    return () => clearTimeout(t);
  }, []);
  return <span ref={here} hidden />;
}
