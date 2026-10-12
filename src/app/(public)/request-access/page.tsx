import { redirect } from "next/navigation";

export default async function RequestAccessRedirect({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  redirect("/join?" + new URLSearchParams(await searchParams).toString());
}
