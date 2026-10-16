import { Disclaimer } from "@/components/disclaimer";

/** Pages reached from a public link or QR code: just the one thing shared, nothing to click around in. */
export default function PublicShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl flex-1">{children}</div>
      <Disclaimer className="mt-10 max-w-md" />
    </div>
  );
}
