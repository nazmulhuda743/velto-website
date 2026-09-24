import { AuthFooterLink, AuthNotice, AuthShell, authButton, authInput } from "@/components/account/AuthShell";
import { forgotPasswordAction } from "../auth-actions";

export const metadata = { title: "Reset password | Velto Premium Laundry" };
type Params = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  return (
    <AuthShell eyebrow="Account access" title="Reset your password" intro="Enter your account email. If it matches an account, we’ll send a reset link."
      footer={<AuthFooterLink href="/login">Back to sign in</AuthFooterLink>}>
      {one(params.sent) === "1" ? <AuthNotice tone="success">If that email belongs to an account, a reset link is on its way. Check spam too.</AuthNotice> : null}
      <form action={forgotPasswordAction} className="space-y-5">
        <label className="block text-[14px] font-semibold text-navy">Email<input className={authInput} name="email" type="email" autoComplete="email" required /></label>
        <button className={authButton}>Send reset link</button>
      </form>
    </AuthShell>
  );
}
