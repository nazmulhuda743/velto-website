import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { accountText } from "@/content/i18n/account";
import { getLocale, localHref } from "@/lib/i18n/server";
import { safeNextPath } from "@/lib/customer/validation";

export async function generateMetadata(): Promise<Metadata> {
  return { title: accountText(await getLocale()).meta.signUp, robots: { index: false, follow: false } };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * One way in: "Continue with your mobile" (or Google) on /login. New or returning is decided
 * after the code, by the account itself (onboarding, or "Welcome back"). Old links land there.
 */
export default async function SignUpPage({ searchParams }: { searchParams: SearchParams }) {
  const next = safeNextPath(one((await searchParams).next));
  redirect(await localHref(`/login${next && next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`));
}
