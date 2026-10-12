import { requireAdmin } from "@/lib/auth";
import { Flash, PageHeader } from "@/components/ui";
import { SignupForm } from "../signup-form";

export const metadata = { title: "New sign-up" };

export default async function NewSignupPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="New sign-up" back={{ href: "/signups", label: "Sign-ups" }} />
      <Flash msg={sp.msg} tone="danger" />
      <SignupForm />
    </>
  );
}
