"use client";

import Link from "@/components/i18n/Link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { SelectField, TextField } from "@/components/forms/fields";
import {
  confirmLinkCodeAction,
  googleSignInAction,
  saveProfileAction,
  sendLinkCodeAction,
  sendPhoneCodeAction,
  verifyPhoneCodeAction,
  type AuthFormState,
} from "@/lib/customer/actions";
import { OUTSIDE_AREA, UTTARA_SECTORS, displayBdPhone } from "@/lib/customer/validation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { AccountText } from "@/content/i18n/account/en";
import { fill } from "@/lib/i18n/config";
import { Alert } from "./Alert";
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

/* ---------- Continue with Google ---------- */

/** Google's four-colour "G", as its sign-in branding guidelines require. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-5 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function GoogleSubmit({ t }: { t: Text }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-[52px] w-full items-center justify-center gap-3 rounded-md lg:h-12 border border-line-strong bg-white px-5 text-[16px] font-semibold text-navy transition-colors hover:border-navy hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan disabled:cursor-wait disabled:opacity-70"
    >
      <GoogleMark />
      {pending ? t.googlePending : t.google}
    </button>
  );
}

function GoogleButton({ t, next }: { t: Text; next: string }) {
  return (
    <form action={googleSignInAction}>
      <input type="hidden" name="next" value={next} />
      <GoogleSubmit t={t} />
    </form>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-6 flex items-center gap-4" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-line" />
      <span className="t-small text-secondary">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/* ---------- Sign in with a mobile number (SMS code) ---------- */

type CodeSent = Extract<AuthFormState, { status: "code-sent" }>;

const RESEND_AFTER_SECONDS = 60;

function TermsCheckbox({ t, name, error }: { t: Text; name: string; error?: string }) {
  const errorId = `${name}-error`;
  return (
    <div>
      <label className="flex items-start gap-3 t-small text-body">
        <input
          type="checkbox"
          name={name}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
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
      {error ? (
        <p id={errorId} className="mt-2 flex items-start gap-2 t-small font-medium text-error">
          <span aria-hidden="true">!</span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Mobile number → SMS code → signed in. New numbers get an account on the spot; the sign-up
 * variant also asks for the name and the terms, so the account is ready straight away.
 */
export function PhoneSignIn({ t, next, mode }: { t: Text; next: string; mode: "signin" | "signup" }) {
  const [sendState, sendAction] = useActionState(sendPhoneCodeAction, IDLE);
  // "Change number" returns to step 1 without a server round trip.
  const [dismissed, setDismissed] = useState<AuthFormState | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(sendState, formRef);
  const errors = errorsOf(sendState);
  const signup = mode === "signup";

  if (sendState.status === "code-sent" && dismissed !== sendState) {
    return (
      <PhoneCodeStep
        key={`${sendState.phone}:${sendState.sentAt ?? 0}`}
        t={t}
        next={next}
        sent={sendState}
        sendAction={sendAction}
        onChangeNumber={() => setDismissed(sendState)}
      />
    );
  }

  const phoneValue = sendState.status === "code-sent" ? sendState.phone : valueOf(sendState, "otpPhone");
  return (
    <form ref={formRef} action={sendAction} noValidate className="space-y-5" data-phone-sign-in>
      <StateMessage state={sendState} t={t} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="mode" value={mode} />
      {signup ? (
        <TextField id="otpName" label={t.fullNameLabel} autoComplete="name" required maxLength={80} defaultValue={valueOf(sendState, "otpName")} error={errors.fullName} />
      ) : null}
      <TextField
        id="otpPhone"
        label={t.phoneLabel}
        type="tel"
        autoComplete="tel-national"
        inputMode="tel"
        required
        maxLength={20}
        placeholder="01712 345678"
        helper={signup ? t.phoneSignUpHelp : t.phoneSignInHelp}
        defaultValue={phoneValue}
        error={errors.phone}
      />
      {signup ? <TermsCheckbox t={t} name="otpTerms" error={errors.terms} /> : null}
      <SubmitButton pending={t.sendingCode}>{t.sendCode}</SubmitButton>
    </form>
  );
}

function ResendButton({ t }: { t: Text }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue disabled:opacity-60">
      {pending ? t.sendingCode : t.resendCode}
    </button>
  );
}

function PhoneCodeStep({
  t,
  next,
  sent,
  sendAction,
  onChangeNumber,
}: {
  t: Text;
  next: string;
  sent: CodeSent;
  sendAction: (form: FormData) => void;
  onChangeNumber: () => void;
}) {
  const locale = useLocale();
  const [state, action] = useActionState(verifyPhoneCodeAction, IDLE);
  const [left, setLeft] = useState(RESEND_AFTER_SECONDS);
  const formRef = useRef<HTMLFormElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  useFocusFirstError(state, formRef);

  useEffect(() => {
    const timer = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    codeRef.current?.focus();
    // Android Chrome can read the code from the SMS (WebOTP; the SMS ends "@www.velto.com.bd #123456").
    if (!("OTPCredential" in window)) return;
    const abort = new AbortController();
    (navigator.credentials.get({ otp: { transport: ["sms"] }, signal: abort.signal } as CredentialRequestOptions) as Promise<{ code?: string } | null>)
      .then((otp) => {
        if (otp?.code && codeRef.current) {
          codeRef.current.value = otp.code;
          formRef.current?.requestSubmit();
        }
      })
      .catch(() => {});
    return () => abort.abort();
  }, []);

  const verifyErrors = state.status === "code-sent" ? (state.errors ?? {}) : {};
  const message =
    state.status === "code-sent" ? state.message : state.status === "error" ? state.message : state.status === "idle" ? sent.message : undefined;

  return (
    <div className="space-y-5" data-phone-code-step>
      <p className="text-body">
        {t.codeSentBefore}
        <strong className="whitespace-nowrap text-navy">{displayBdPhone(sent.phone)}</strong>
        {t.codeSentAfter}
      </p>
      {sent.resent && !sent.message && state.status === "idle" ? <Alert tone="success">{t.codeResent}</Alert> : null}
      {state.status === "unavailable" ? <Unavailable t={t} /> : message ? <Alert tone="error">{message}</Alert> : null}
      <form ref={formRef} action={action} noValidate className="space-y-5">
        <input type="hidden" name="otpPhone" value={sent.phone} />
        <input type="hidden" name="next" value={next} />
        <TextField
          ref={codeRef}
          id="otpCode"
          label={t.codeLabel}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          required
          maxLength={6}
          error={verifyErrors.code}
        />
        <SubmitButton pending={t.verifyingCode}>{t.verifyCode}</SubmitButton>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 t-small">
        <button type="button" onClick={onChangeNumber} className="font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue">
          {t.changeNumber}
        </button>
        {left > 0 ? (
          <span className="text-secondary">{fill(t.resendIn, { s: left }, locale)}</span>
        ) : (
          <form action={sendAction}>
            <input type="hidden" name="otpPhone" value={sent.phone} />
            <input type="hidden" name="resend" value="1" />
            <ResendButton t={t} />
          </form>
        )}
      </div>
    </div>
  );
}

/** Mobile number first, then Google. Customers don't use passwords. */
function Methods({ t, next, mode, google, phone }: { t: Text; next: string; mode: "signin" | "signup"; google: boolean; phone: boolean }) {
  if (!phone && !google) return <Unavailable t={t} />;
  return (
    <>
      {phone ? <PhoneSignIn t={t} next={next} mode={mode} /> : null}
      {phone && google ? <Divider label={t.orDivider} /> : null}
      {google ? <GoogleButton t={t} next={next} /> : null}
    </>
  );
}

/* ---------- Sign in ---------- */

export function SignInForm({
  t,
  next,
  notice,
  google = false,
  phone = false,
}: {
  t: Text;
  next: string;
  notice?: React.ReactNode;
  google?: boolean;
  phone?: boolean;
}) {
  return (
    <>
      {notice ? <div className="mb-5">{notice}</div> : null}
      <Methods t={t} next={next} mode="signin" google={google} phone={phone} />
    </>
  );
}

/* ---------- Sign up ---------- */

export function SignUpForm({ t, next, google = false, phone = false }: { t: Text; next: string; google?: boolean; phone?: boolean }) {
  return <Methods t={t} next={next} mode="signup" google={google} phone={phone} />;
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
  phoneLocked: "verified" | "linked" | "pending" | null;
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
            {phoneLocked === "verified" ? t.lockedVerified : phoneLocked === "linked" ? t.lockedLinked : t.lockedPending}
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

/* ---------- Show my past orders (prove the account's phone by SMS) ---------- */

type LinkText = AccountText["link"];

/**
 * Email and Google accounts: one tap texts a code to the phone on the account; the right code
 * links the order history at once. Rendered inside LinkHistoryCard.
 */
export function LinkBySms({ t, phone }: { t: LinkText; phone: string }) {
  const [sendState, sendAction] = useActionState(sendLinkCodeAction, IDLE);
  const [state, confirmAction] = useActionState(confirmLinkCodeAction, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);

  if (state.status === "linked") {
    return (
      <Alert tone={state.result === "linked" ? "success" : "info"}>
        {state.result === "linked" ? t.linkedDone : state.result === "pending" ? t.pendingDone : t.noOrders}
      </Alert>
    );
  }

  const codeStep = sendState.status === "code-sent" || state.status === "code-sent";
  if (!codeStep) {
    return (
      <form action={sendAction} className="space-y-3">
        {sendState.status === "error" ? <Alert tone="error">{sendState.message}</Alert> : null}
        <SubmitButton pending={t.smsSending}>{t.smsButton}</SubmitButton>
      </form>
    );
  }

  const errors = state.status === "code-sent" ? (state.errors ?? {}) : {};
  const message =
    state.status === "code-sent" ? state.message : state.status === "error" ? state.message : sendState.status === "code-sent" ? sendState.message : undefined;
  return (
    <div className="space-y-4" data-link-code-step>
      <p className="t-small text-body">
        {t.codeSentBefore}
        <strong className="whitespace-nowrap text-navy">{displayBdPhone(phone)}</strong>
        {t.codeSentAfter}
      </p>
      {message ? <Alert tone="error">{message}</Alert> : null}
      <form ref={formRef} action={confirmAction} noValidate className="space-y-4">
        <TextField
          id="linkCode"
          label={t.codeLabel}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          required
          maxLength={6}
          error={errors.code}
        />
        <SubmitButton pending={t.confirming}>{t.confirm}</SubmitButton>
      </form>
      <form action={sendAction}>
        <input type="hidden" name="resend" value="1" />
        <button type="submit" className="t-small font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue">
          {t.resend}
        </button>
      </form>
    </div>
  );
}

