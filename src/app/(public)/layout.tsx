import Link from "next/link";
import { publicAppName } from "@/lib/wards";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const name = publicAppName();
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="h-16 w-16 rounded-2xl shadow-sm" />
        <h1 className="text-xl font-bold text-text">{name}</h1>
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-8 max-w-sm text-center text-xs text-muted">
        An unofficial ward app. Not an official website of The Church of Jesus Christ of Latter-day Saints. ·{" "}
        <Link href="/privacy" className="underline">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>
      </p>
    </div>
  );
}
