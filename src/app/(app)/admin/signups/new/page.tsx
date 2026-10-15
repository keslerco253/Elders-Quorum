import { requireAdmin } from "@/lib/auth";
import { Flash, PageHeader } from "@/components/ui";
import { SignupForm } from "../signup-form";

export const metadata = { title: "New service opportunity" };

export default async function NewSignupPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="New service opportunity" back={{ href: "/signups", label: "Service" }} />
      <Flash msg={sp.msg} tone="danger" />
      <SignupForm />
    </>
  );
}
