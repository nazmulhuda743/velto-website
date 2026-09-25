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
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { AccountText } from "@/content/i18n/account/en";
import { fill } from "@/lib/i18n/config";
import { Alert } from "./Alert";
import { PasswordField } from "./PasswordField";
import { SubmitButton } from "./SubmitButton";

const IDLE: AuthFormState = { status: "idle" };

/** Form text in the page language (accountText(locale).forms), passed by the server page. */
type Text = AccountText["forms"];

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

function Unavailable({ t }: { t: Text }) {
  return (
    <Alert tone="error" title={t.unavailableTitle}>
      {t.unavailableBefore}
      <Link href="/book" className="font-semibold text-navy underline underline-offset-4">
        {t.bookLink}
      </Link>
      {t.or}
      <Link href="/track" className="font-semibold text-navy underline underline-offset-4">
        {t.trackLink}
      </Link>
      {t.unavailableAfter}
    </Alert>
  );
}

function StateMessage({ state, t }: { state: AuthFormState; t: Text }) {
  if (state.status === "unavailable") return <Unavailable t={t} />;
  if (state.status === "error") return <Alert tone="error">{state.message}</Alert>;
  if (state.status === "invalid" && state.message) return <Alert tone="error">{state.message}</Alert>;
  return null;
}

/* ---------- Sign in ---------- */

/** Show/hide labels for PasswordField, in the page language. */
const toggleLabels = (t: Text) => ({ show: t.show, hide: t.hide, srPassword: t.srPassword });

export function SignInForm({ t, next, notice }: { t: Text; next: string; notice?: React.ReactNode }) {
  const [state, action] = useActionState(signInAction, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const errors = errorsOf(state);

  if (state.status === "verify-required") return <VerifyEmail t={t} email={state.email} />;

  return (
    <form ref={formRef} action={action} noValidate className="space-y-5">
      {notice}
      <StateMessage state={state} t={t} />
      <input type="hidden" name="next" value={next} />
      <TextField id="email" label={t.emailLabel} type="email" autoComplete="email" inputMode="email" required maxLength={254} defaultValue={valueOf(state, "email")} error={errors.email} />
      <PasswordField id="password" label={t.passwordLabel} autoComplete="current-password" error={errors.password} labels={toggleLabels(t)} />
      <div className="-mt-1 flex justify-end">
        <Link href="/forgot-password" className="t-small font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue">
          {t.forgot}
        </Link>
      </div>
      <SubmitButton pending={t.signInPending}>{t.signInSubmit}</SubmitButton>
      <p className="border-t border-line pt-5 text-center t-small text-secondary">
        {t.newTo}
        <Link href={`/signup${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue">
          {t.createLink}
        </Link>
      </p>
    </form>
  );
}

/* ---------- Verification required / resend ---------- */

export function VerifyEmail({ t, email }: { t: Text; email: string }) {
  const [state, action] = useActionState(resendVerificationAction, IDLE);
  return (
    <div className="space-y-5">
      <Alert tone="info" title={t.verifyTitle}>
        {t.verifyBefore}
        <strong className="text-navy">{email}</strong>
        {t.verifyAfter}
      </Alert>
      {state.status === "sent" ? (
        <Alert tone="success">{t.resent}</Alert>
      ) : (
        <form action={action}>
          <input type="hidden" name="email" value={email} />
          <StateMessage state={state} t={t} />
          <SubmitButton pending={t.sending} variant="secondary" className={state.status === "idle" ? "" : "mt-4"}>
            {t.resend}
          </SubmitButton>
        </form>
      )}
      <p className="text-center t-small">
        <Link href="/login" className="font-semibold text-navy underline decoration-blue/50 underline-offset-4">
          {t.backToSignIn}
        </Link>
      </p>
    </div>
  );
}

/* ---------- Sign up ---------- */

export function SignUpForm({ t, next }: { t: Text; next: string }) {
  const locale = useLocale();
  const [state, action] = useActionState(signUpAction, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const errors = errorsOf(state);

  if (state.status === "check-email") {
    return (
      <div className="space-y-5" data-signup-sent>
        <Alert tone="success" title={t.checkTitle}>
          {t.checkBefore}
          <strong className="text-navy">{state.email}</strong>
          {t.checkAfter}
        </Alert>
        <p className="t-small text-secondary">
          {t.alreadyBefore}
          <Link href="/login" className="font-semibold text-navy underline underline-offset-4">
            {t.alreadySignIn}
          </Link>
          {t.or}
          <Link href="/forgot-password" className="font-semibold text-navy underline underline-offset-4">
            {t.alreadyReset}
          </Link>
          {t.alreadyAfter}
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} noValidate className="space-y-5">
      <StateMessage state={state} t={t} />
      <TextField id="fullName" label={t.fullNameLabel} autoComplete="name" required maxLength={80} defaultValue={valueOf(state, "fullName")} error={errors.fullName} />
      <TextField id="email" label={t.emailLabel} type="email" autoComplete="email" inputMode="email" required maxLength={254} defaultValue={valueOf(state, "email")} error={errors.email} />
      <TextField
        id="phone"
        label={t.phoneLabel}
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        required
        maxLength={20}
        placeholder="01712 345678"
        helper={t.phoneHelp}
        defaultValue={valueOf(state, "phone")}
        error={errors.phone}
      />
      <PasswordField
        id="password"
        label={t.passwordLabel}
        autoComplete="new-password"
        helper={fill(t.passwordHelp, { n: PASSWORD_MIN }, locale)}
        error={errors.password}
        labels={toggleLabels(t)}
      />
      <PasswordField id="confirm" label={t.confirmLabel} autoComplete="new-password" error={errors.confirm} labels={toggleLabels(t)} />
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
            {t.agreeBefore}
            <Link href="/terms" target="_blank" className="font-semibold text-navy underline underline-offset-4">
              {t.termsLink}
            </Link>
            {t.and}
            <Link href="/privacy" target="_blank" className="font-semibold text-navy underline underline-offset-4">
              {t.privacyLink}
            </Link>
            {t.agreeAfter}
          </span>
        </label>
        {errors.terms ? (
          <p id="terms-error" className="mt-2 flex items-start gap-2 t-small font-medium text-error">
            <span aria-hidden="true">!</span>
            {errors.terms}
          </p>
        ) : null}
      </div>
      <SubmitButton pending={t.signUpPending}>{t.signUpSubmit}</SubmitButton>
      <p className="border-t border-line pt-5 text-center t-small text-secondary">
        {t.haveAccount}
        <Link href={`/login${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue">
          {t.signInLink}
        </Link>
      </p>
    </form>
  );
}

/* ---------- Forgot password ---------- */

export function ForgotPasswordForm({ t }: { t: Text }) {
  const [state, action] = useActionState(forgotPasswordAction, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);

  if (state.status === "sent") {
    return (
      <div className="space-y-5" data-reset-sent>
        <Alert tone="success" title={t.checkTitle}>
          {t.forgotSent}
        </Alert>
        <p className="text-center t-small">
          <Link href="/login" className="font-semibold text-navy underline decoration-blue/50 underline-offset-4">
            {t.backToSignIn}
          </Link>
        </p>
      </div>
    );
  }
  return (
    <form ref={formRef} action={action} noValidate className="space-y-5">
      <StateMessage state={state} t={t} />
      <TextField id="email" label={t.emailLabel} type="email" autoComplete="email" inputMode="email" required maxLength={254} error={errorsOf(state).email} />
      <SubmitButton pending={t.sending}>{t.forgotSubmit}</SubmitButton>
      <p className="text-center t-small">
        <Link href="/login" className="font-semibold text-navy underline decoration-blue/50 underline-offset-4">
          {t.backToSignIn}
        </Link>
      </p>
    </form>
  );
}

/* ---------- Reset password ---------- */

export function ExpiredResetLink({ t }: { t: Text }) {
  return (
    <div className="space-y-5" data-reset-expired>
      <Alert tone="error" title={t.expiredTitle}>
        {t.expiredBody}
      </Alert>
      <Link href="/forgot-password" className="inline-flex h-[52px] w-full items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover lg:h-12">
        {t.expiredButton}
      </Link>
    </div>
  );
}

export function ResetPasswordForm({ t }: { t: Text }) {
  const locale = useLocale();
  const [state, action] = useActionState(resetPasswordAction, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const errors = errorsOf(state);
  if (state.status === "expired") return <ExpiredResetLink t={t} />;
  return (
    <form ref={formRef} action={action} noValidate className="space-y-5">
      <StateMessage state={state} t={t} />
      <PasswordField
        id="password"
        label={t.newPasswordLabel}
        autoComplete="new-password"
        helper={fill(t.passwordHelp, { n: PASSWORD_MIN }, locale)}
        error={errors.password}
        labels={toggleLabels(t)}
      />
      <PasswordField id="confirm" label={t.confirmNewLabel} autoComplete="new-password" error={errors.confirm} labels={toggleLabels(t)} />
      <SubmitButton pending={t.saving}>{t.savePassword}</SubmitButton>
    </form>
  );
}

/* ---------- Profile ---------- */

export function ProfileForm({
  t,
  initial,
  phoneLocked,
  completing = false,
}: {
  t: Text;
  initial: { fullName: string; phone: string; address: string; area: string };
  phoneLocked: "linked" | "pending" | null;
  completing?: boolean;
}) {
  const [state, action] = useActionState(saveProfileAction, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const errors = errorsOf(state);
  const v = (key: keyof typeof initial) => valueOf(state, key) ?? initial[key];
  const locale = useLocale();

  return (
    <form ref={formRef} action={action} noValidate className="space-y-5">
      {state.status === "saved" ? <Alert tone="success">{t.saved}</Alert> : null}
      <StateMessage state={state} t={t} />
      {completing ? <input type="hidden" name="completing" value="1" /> : null}
      <TextField id="fullName" label={t.fullNameLabel} autoComplete="name" required maxLength={80} defaultValue={v("fullName")} error={errors.fullName} />
      {phoneLocked ? (
        <div>
          <p className="block text-[15px] font-semibold text-navy">{t.phoneLabel}</p>
          <input type="hidden" name="phone" value={initial.phone} />
          <p className="mt-2 flex h-[54px] items-center rounded-md border border-line bg-soft px-4 text-navy md:h-[52px]">{displayBdPhone(initial.phone)}</p>
          <p className="mt-2 t-small text-secondary">
            {phoneLocked === "linked" ? t.lockedLinked : t.lockedPending}
          </p>
        </div>
      ) : (
        <TextField id="phone" label={t.phoneLabel} type="tel" autoComplete="tel" inputMode="tel" required maxLength={20} defaultValue={v("phone")} error={errors.phone} />
      )}
      <SelectField id="area" label={t.areaLabel} optional optionalText={t.optional} defaultValue={v("area")} error={errors.area}>
        <option value="">{t.areaNotSet}</option>
        {UTTARA_SECTORS.map((n) => (
          <option key={n} value={n}>
            {fill(t.areaSector, { n }, locale)}
          </option>
        ))}
        <option value={OUTSIDE_AREA}>{t.areaOutside}</option>
      </SelectField>
      <TextField
        id="address"
        label={t.addressLabel}
        optional
        optionalText={t.optional}
        autoComplete="street-address"
        maxLength={300}
        helper={t.addressHelp}
        defaultValue={v("address")}
        error={errors.address}
      />
      {completing ? (
        <label className="flex items-start gap-3 t-small text-body">
          <input type="checkbox" name="terms" required aria-invalid={errors.terms ? true : undefined} className="mt-0.5 size-5 shrink-0 accent-[var(--color-action)]" />
          <span>
            {t.agreeBefore}
            <Link href="/terms" target="_blank" className="font-semibold text-navy underline underline-offset-4">
              {t.termsLink}
            </Link>
            {t.and}
            <Link href="/privacy" target="_blank" className="font-semibold text-navy underline underline-offset-4">
              {t.privacyLink}
            </Link>
            {t.agreeAfter}
            {errors.terms ? <span className="mt-1 block font-medium text-error">{errors.terms}</span> : null}
          </span>
        </label>
      ) : null}
      <SubmitButton pending={t.saving} className="md:w-auto">
        {completing ? t.continue : t.saveDetails}
      </SubmitButton>
    </form>
  );
}
