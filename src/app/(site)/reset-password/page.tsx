import { AuthFooterLink, AuthNotice, AuthShell, authButton, authInput } from "@/components/account/AuthShell";
import { resetPasswordAction } from "../auth-actions";
import { getPortalIdentity } from "@/lib/supabase/portal-server";

type Params = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
export const metadata = { title: "Choose new password | Velto Premium Laundry" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const identity = await getPortalIdentity();
  const invalid = one(params.invalid) === "1" || !identity;
  return (
    <AuthShell eyebrow="Account access" title={invalid ? "This reset link can’t be used" : "Choose a new password"} intro={invalid ? "The link may have expired, already been used, or the session is no longer valid." : "Set a new password for your Velto account."}
      footer={<AuthFooterLink href={invalid ? "/forgot-password" : "/login"}>{invalid ? "Request another reset link" : "Back to sign in"}</AuthFooterLink>}>
      {invalid ? <AuthNotice tone="error">For your security, reset links are one-time and time-limited.</AuthNotice> : (
        <>
          {one(params.error) ? <AuthNotice tone="error">Passwords must match and contain at least 10 characters.</AuthNotice> : null}
          <form action={resetPasswordAction} className="space-y-5">
            <label className="block text-[14px] font-semibold text-navy">New password<input className={authInput} name="password" type="password" autoComplete="new-password" minLength={10} required /></label>
            <label className="block text-[14px] font-semibold text-navy">Confirm new password<input className={authInput} name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required /></label>
            <button className={authButton}>Update password</button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
