"use client";

import Link from "@/components/i18n/Link";
import { useActionState, useEffect, useRef } from "react";
import { SelectField, TextField } from "@/components/forms/fields";
import {
  forgotPasswordAction,
  resendVerificationAction,
  resetPasswordAction,
  saveProfileAction,
  signInAction,
  signUpAction,
  type AuthFormState,
} from "@/lib/customer/actions";
import { OUTSIDE_AREA, PASSWORD_MIN, UTTARA_SECTORS, displayBdPhone } from "@/lib/customer/validation";
import { Alert } from "./Alert";
import { PasswordField } from "./PasswordField";
import { SubmitButton } from "./SubmitButton";

const IDLE: AuthFormState = { status: "idle" };

const errorsOf = (s: AuthFormState) => (s.status === "invalid" ? s.errors : {});
const valueOf = (s: AuthFormState, key: string) => ("values" in s && s.values ? s.values[key] : undefined);

/** Moves focus to the first problem so keyboard and screen-reader users land on it. */
function useFocusFirstError(state: AuthFormState, formRef: React.RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    if (state.status === "idle") return;
    const target = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]');
    target?.focus?.();
    if (target && target.getAttribute("role") === "alert") target.scrollIntoView({ block: "center" });
  }, [state, formRef]);
}

function Unavailable() {
  return (
    <Alert tone="error" title="We can't reach Velto accounts right now.">
      Check your connection and try again in a moment. You can still{" "}
      <Link href="/book" className="font-semibold text-navy underline underline-offset-4">
        book a pickup
      </Link>{" "}
      or{" "}
      <Link href="/track" className="font-semibold text-navy underline underline-offset-4">
        track an order
      </Link>{" "}
      without signing in.
    </Alert>
  );
}

function StateMessage({ state }: { state: AuthFormState }) {
  if (state.status === "unavailable") return <Unavailable />;
  if (state.status === "error") return <Alert tone="error">{state.message}</Alert>;
  if (state.status === "invalid" && state.message) return <Alert tone="error">{state.message}</Alert>;
  return null;
}

/* ---------- Sign in ---------- */

export function SignInForm({ next, notice }: { next: string; notice?: React.ReactNode }) {
  const [state, action] = useActionState(signInAction, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const errors = errorsOf(state);

  if (state.status === "verify-required") return <VerifyEmail email={state.email} />;

  return (
    <form ref={formRef} action={action} noValidate className="space-y-5">
      {notice}
      <StateMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <TextField id="email" label="Email" type="email" autoComplete="email" inputMode="email" required maxLength={254} defaultValue={valueOf(state, "email")} error={errors.email} />
      <PasswordField id="password" label="Password" autoComplete="current-password" error={errors.password} />
      <div className="-mt-1 flex justify-end">
        <Link href="/forgot-password" className="t-small font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue">
          Forgot password?
        </Link>
      </div>
      <SubmitButton pending="Signing in…">Sign in</SubmitButton>
      <p className="border-t border-line pt-5 text-center t-small text-secondary">
        New to Velto accounts?{" "}
        <Link href={`/signup${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue">
          Create an account
        </Link>
      </p>
    </form>
  );
}

/* ---------- Verification required / resend ---------- */

export function VerifyEmail({ email }: { email: string }) {
  const [state, action] = useActionState(resendVerificationAction, IDLE);
  return (
    <div className="space-y-5">
      <Alert tone="info" title="Please confirm your email first.">
        We sent a confirmation link to <strong className="text-navy">{email}</strong>. Open it on this phone or computer, then sign in.
      </Alert>
      {state.status === "sent" ? (
        <Alert tone="success">If that address needs confirming, a new link is on its way. It can take a few minutes; check spam too.</Alert>
      ) : (
        <form action={action}>
          <input type="hidden" name="email" value={email} />
          <StateMessage state={state} />
          <SubmitButton pending="Sending…" variant="secondary" className={state.status === "idle" ? "" : "mt-4"}>
            Send the link again
          </SubmitButton>
        </form>
      )}
      <p className="text-center t-small">
        <Link href="/login" className="font-semibold text-navy underline decoration-blue/50 underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

/* ---------- Sign up ---------- */

export function SignUpForm({ next }: { next: string }) {
  const [state, action] = useActionState(signUpAction, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const errors = errorsOf(state);

  if (state.status === "check-email") {
    return (
      <div className="space-y-5" data-signup-sent>
        <Alert tone="success" title="Check your email.">
          We&apos;ve sent a link to <strong className="text-navy">{state.email}</strong>. Open it to confirm your address and finish setting up your account.
        </Alert>
        <p className="t-small text-secondary">
          Already have an account with this email? Just{" "}
          <Link href="/login" className="font-semibold text-navy underline underline-offset-4">
            sign in
          </Link>{" "}
          or{" "}
          <Link href="/forgot-password" className="font-semibold text-navy underline underline-offset-4">
            reset your password
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} noValidate className="space-y-5">
      <StateMessage state={state} />
      <TextField id="fullName" label="Full name" autoComplete="name" required maxLength={80} defaultValue={valueOf(state, "fullName")} error={errors.fullName} />
      <TextField id="email" label="Email" type="email" autoComplete="email" inputMode="email" required maxLength={254} defaultValue={valueOf(state, "email")} error={errors.email} />
      <TextField
        id="phone"
        label="Mobile number"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        required
        maxLength={20}
        placeholder="01712 345678"
        helper="We use it to confirm pickups. It doesn't unlock past orders by itself."
        defaultValue={valueOf(state, "phone")}
        error={errors.phone}
      />
      <PasswordField id="password" label="Password" autoComplete="new-password" helper={`At least ${PASSWORD_MIN} characters, with a letter and a number.`} error={errors.password} />
      <PasswordField id="confirm" label="Confirm password" autoComplete="new-password" error={errors.confirm} />
      <div>
        <label className="flex items-start gap-3 t-small text-body">
          <input
            type="checkbox"
            name="terms"
            required
            aria-invalid={errors.terms ? true : undefined}
            aria-describedby={errors.terms ? "terms-error" : undefined}
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-action)]"
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="font-semibold text-navy underline underline-offset-4">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="font-semibold text-navy underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {errors.terms ? (
          <p id="terms-error" className="mt-2 flex items-start gap-2 t-small font-medium text-error">
            <span aria-hidden="true">!</span>
            {errors.terms}
          </p>
        ) : null}
      </div>
      <SubmitButton pending="Creating your account…">Create account</SubmitButton>
      <p className="border-t border-line pt-5 text-center t-small text-secondary">
        Already have an account?{" "}
        <Link href={`/login${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue">
          Sign in
        </Link>
      </p>
    </form>
  );
}

/* ---------- Forgot password ---------- */

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);

  if (state.status === "sent") {
    return (
      <div className="space-y-5" data-reset-sent>
        <Alert tone="success" title="Check your email.">
          If there&apos;s a Velto account for that address, we&apos;ve sent a link to reset the password. It works once and expires soon, so use it shortly.
        </Alert>
        <p className="text-center t-small">
          <Link href="/login" className="font-semibold text-navy underline decoration-blue/50 underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }
  return (
    <form ref={formRef} action={action} noValidate className="space-y-5">
      <StateMessage state={state} />
      <TextField id="email" label="Email" type="email" autoComplete="email" inputMode="email" required maxLength={254} error={errorsOf(state).email} />
      <SubmitButton pending="Sending…">Send reset link</SubmitButton>
      <p className="text-center t-small">
        <Link href="/login" className="font-semibold text-navy underline decoration-blue/50 underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

/* ---------- Reset password ---------- */

export function ExpiredResetLink() {
  return (
    <div className="space-y-5" data-reset-expired>
      <Alert tone="error" title="This reset link has expired or was already used.">
        For your security, each link works once and only for a short time. Request a new one below.
      </Alert>
      <Link href="/forgot-password" className="inline-flex h-[52px] w-full items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover lg:h-12">
        Send a new link
      </Link>
    </div>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPasswordAction, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const errors = errorsOf(state);
  if (state.status === "expired") return <ExpiredResetLink />;
  return (
    <form ref={formRef} action={action} noValidate className="space-y-5">
      <StateMessage state={state} />
      <PasswordField id="password" label="New password" autoComplete="new-password" helper={`At least ${PASSWORD_MIN} characters, with a letter and a number.`} error={errors.password} />
      <PasswordField id="confirm" label="Confirm new password" autoComplete="new-password" error={errors.confirm} />
      <SubmitButton pending="Saving…">Save new password</SubmitButton>
    </form>
  );
}

/* ---------- Profile ---------- */

export function ProfileForm({
  initial,
  phoneLocked,
  completing = false,
}: {
  initial: { fullName: string; phone: string; address: string; area: string };
  phoneLocked: "linked" | "pending" | null;
  completing?: boolean;
}) {
  const [state, action] = useActionState(saveProfileAction, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const errors = errorsOf(state);
  const v = (key: keyof typeof initial) => valueOf(state, key) ?? initial[key];

  return (
    <form ref={formRef} action={action} noValidate className="space-y-5">
      {state.status === "saved" ? <Alert tone="success">Saved. We&apos;ll use these details next time you book.</Alert> : null}
      <StateMessage state={state} />
      {completing ? <input type="hidden" name="completing" value="1" /> : null}
      <TextField id="fullName" label="Full name" autoComplete="name" required maxLength={80} defaultValue={v("fullName")} error={errors.fullName} />
      {phoneLocked ? (
        <div>
          <p className="block text-[15px] font-semibold text-navy">Mobile number</p>
          <input type="hidden" name="phone" value={initial.phone} />
          <p className="mt-2 flex h-[54px] items-center rounded-md border border-line bg-soft px-4 text-navy md:h-[52px]">{displayBdPhone(initial.phone)}</p>
          <p className="mt-2 t-small text-secondary">
            {phoneLocked === "linked"
              ? "This number is verified with your Velto history. To change it, message Velto so we can verify the new number."
              : "This number is waiting for Velto to verify it, so it can't be changed right now."}
          </p>
        </div>
      ) : (
        <TextField id="phone" label="Mobile number" type="tel" autoComplete="tel" inputMode="tel" required maxLength={20} defaultValue={v("phone")} error={errors.phone} />
      )}
      <SelectField id="area" label="Area" optional defaultValue={v("area")} error={errors.area}>
        <option value="">Not set</option>
        {UTTARA_SECTORS.map((n) => (
          <option key={n} value={n}>
            Uttara Sector {n}
          </option>
        ))}
        <option value={OUTSIDE_AREA}>Outside Sectors 1–18</option>
      </SelectField>
      <TextField id="address" label="Pickup address" optional autoComplete="street-address" maxLength={300} helper="House, road and any landmark our rider should know." defaultValue={v("address")} error={errors.address} />
      {completing ? (
        <label className="flex items-start gap-3 t-small text-body">
          <input type="checkbox" name="terms" required aria-invalid={errors.terms ? true : undefined} className="mt-0.5 size-5 shrink-0 accent-[var(--color-action)]" />
          <span>
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="font-semibold text-navy underline underline-offset-4">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="font-semibold text-navy underline underline-offset-4">
              Privacy Policy
            </Link>
            .{errors.terms ? <span className="mt-1 block font-medium text-error">{errors.terms}</span> : null}
          </span>
        </label>
      ) : null}
      <SubmitButton pending="Saving…" className="md:w-auto">
        {completing ? "Continue" : "Save details"}
      </SubmitButton>
    </form>
  );
}
