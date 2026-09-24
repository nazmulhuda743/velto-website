import { redirect } from "next/navigation";
import { AuthFooterLink, AuthNotice, AuthShell, authButton, authInput } from "@/components/account/AuthShell";
import { loginAction } from "../auth-actions";
import { getPortalIdentity } from "@/lib/supabase/portal-server";
import { safePortalNext } from "@/lib/supabase/portal-config";

export const metadata = { title: "Sign in | Velto Premium Laundry" };
export const dynamic = "force-dynamic";
type Params = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;

export default async function LoginPage({ searchParams }: { searchParams: Params }) {
  if (await getPortalIdentity()) redirect("/account");
  const params = await searchParams;
  const next = safePortalNext(one(params.next));
  return (
    <AuthShell eyebrow="Velto account" title="Welcome back" intro="See your orders, profile and pickup details in one quiet place."
      footer={<>New to the account area? <AuthFooterLink href="/signup">Create an account</AuthFooterLink>.</>}>
      {one(params.error) ? <AuthNotice tone="error">The email or password did not match. Try again, or reset your password.</AuthNotice> : null}
      {one(params.reason) === "session" ? <AuthNotice>Your session ended. Sign in again to continue.</AuthNotice> : null}
      {one(params.state) === "reset-success" ? <AuthNotice tone="success">Password updated. Sign in with your new password.</AuthNotice> : null}
      {one(params.state) === "signed-out" ? <AuthNotice tone="success">You’re signed out.</AuthNotice> : null}
      <form action={loginAction} className="space-y-5">
        <input type="hidden" name="next" value={next} />
        <label className="block text-[14px] font-semibold text-navy">Email<input className={authInput} name="email" type="email" autoComplete="email" required /></label>
        <label className="block text-[14px] font-semibold text-navy">Password<input className={authInput} name="password" type="password" autoComplete="current-password" required /></label>
        <div className="flex items-center justify-between gap-4"><AuthFooterLink href="/forgot-password">Forgot password?</AuthFooterLink></div>
        <button className={authButton}>Sign in</button>
      </form>
    </AuthShell>
  );
}
