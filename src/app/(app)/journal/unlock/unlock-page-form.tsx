"use client";

import { useRouter } from "next/navigation";
import { UnlockForm } from "../unlock-form";

export function UnlockPageForm({ next }: { next: string }) {
  const router = useRouter();
  return (
    <UnlockForm
      onOpen={() => {
        router.replace(next);
        router.refresh();
      }}
    />
  );
}
