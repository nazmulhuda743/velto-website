import { redirect } from "next/navigation";
import { AuthFooterLink, AuthNotice, AuthShell, authButton, authInput } from "@/components/account/AuthShell";
import { signupAction } from "../auth-actions";
import { getPortalIdentity } from "@/lib/supabase/portal-server";

export const metadata = { title: "Create account | Velto Premium Laundry" };
export const dynamic = "force-dynamic";
type Params = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;

export default async function SignupPage({ searchParams }: { searchParams: Params }) {
  if (await getPortalIdentity()) redirect("/account");
  const params = await searchParams;
  const pending = one(params.state) === "verification-pending";
  return (
    <AuthShell eyebrow="Velto account" title={pending ? "Check your email" : "Create your account"} intro={pending ? "Open the verification email from Velto to finish setting up your account." : "Your account starts private. Existing laundry history is linked only after Velto verifies it."}
      footer={<>Already have an account? <AuthFooterLink href="/login">Sign in</AuthFooterLink>.</>}>
      {pending ? <AuthNotice tone="success">Verification is pending. The link in your email is one-time use.</AuthNotice> : (
        <>
          {one(params.error) ? <AuthNotice tone="error">We couldn’t create the account with those details. Check the form and try again.</AuthNotice> : null}
          <form action={signupAction} className="space-y-5">
            <label className="block text-[14px] font-semibold text-navy">Name<input className={authInput} name="fullName" autoComplete="name" required /></label>
            <label className="block text-[14px] font-semibold text-navy">Email<input className={authInput} name="email" type="email" autoComplete="email" required /></label>
            <label className="block text-[14px] font-semibold text-navy">Phone <span className="font-normal text-secondary">optional for signup</span><input className={authInput} name="phone" type="tel" autoComplete="tel" placeholder="01XXX XXXXXX" /></label>
            <label className="block text-[14px] font-semibold text-navy">Password<input className={authInput} name="password" type="password" autoComplete="new-password" minLength={10} required /><span className="mt-2 block font-normal text-secondary">Use at least 10 characters.</span></label>
            <label className="flex items-start gap-3 t-small text-body"><input className="mt-1 size-4 accent-[#0078bc]" name="terms" type="checkbox" required /><span>I agree to use my account details for Velto account and order services.</span></label>
            <button className={authButton}>Create account</button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
