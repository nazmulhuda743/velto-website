"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "@/components/i18n/Link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { track } from "@/components/layout/Analytics";
import type { FormText } from "@/content/i18n/forms/en";
import { sendPhoneCodeAction, verifyBookingCodeAction, type AuthFormState } from "@/lib/customer/actions";
import { displayBdPhone } from "@/lib/customer/validation";
import { fill } from "@/lib/i18n/config";
import { phoneOk } from "./fields";

type Text = FormText["booking"]["verify"];

const IDLE: AuthFormState = { status: "idle" };
const RESEND_AFTER_SECONDS = 60;

/**
 * The mobile verification inside the booking form's "Your details": "Text me a code" → the
 * 6-digit code → signed in, on the same page. It is the website's sign-in (Supabase phone OTP,
 * account created on first use), so every website booking comes from an account and shows there.
 * No <form> of its own (the booking form is one form): the server actions are called directly.
 */
export function BookingVerify({
  t,
  name,
  phone,
  notice,
  fallback,
  onFieldErrors,
  onPending,
  onVerified,
}: {
  t: Text;
  name: string;
  phone: string;
  /** A problem reported by the booking itself (the sign-in ended before Book). */
  notice?: string;
  /** "Book on WhatsApp" for when the code can't be sent or checked. */
  fallback: React.ReactNode;
  onFieldErrors: (errors: { name?: string; phone?: string }) => void;
  /** A code is on its way: the phone field locks until it is checked or the number is changed. */
  onPending: (pending: boolean) => void;
  onVerified: (phone: string, newUser: boolean) => void;
}) {
  const locale = useLocale();
  const [sent, setSent] = useState<Extract<AuthFormState, { status: "code-sent" }> | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [left, setLeft] = useState(RESEND_AFTER_SECONDS);
  const [busy, startTransition] = useTransition();
  const codeRef = useRef<HTMLInputElement>(null);
  const shown = useRef(false);
  const callbacks = useRef({ onPending, onVerified });
  useEffect(() => {
    callbacks.current = { onPending, onVerified };
  }, [onPending, onVerified]);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    track("booking_verify_shown", { section: "booking-form" });
  }, []);

  const failed = (reason: string, message: string | null) => {
    track("booking_verify_failed", { reason });
    setProblem(message);
  };

  const send = (resend = false) => {
    if (!resend) {
      const errors: { name?: string; phone?: string } = {};
      if (name.trim().length < 2) errors.name = "";
      if (!phoneOk(phone)) errors.phone = "";
      if (errors.name !== undefined || errors.phone !== undefined) {
        onFieldErrors(errors);
        return;
      }
    }
    setProblem(null);
    setCodeError(null);
    const fd = new FormData();
    fd.set("mode", "signup");
    fd.set("otpPhone", phone);
    fd.set("otpName", name.trim());
    fd.set("otpTerms", "on");
    if (resend) fd.set("resend", "1");
    startTransition(async () => {
      const state = await sendPhoneCodeAction(IDLE, fd);
      if (state.status === "code-sent") {
        if (state.message) {
          // The resend was refused (too many codes): the step stays on the code field.
          setProblem(state.message);
        } else {
          setSent(state);
          setResent(resend);
          setLeft(RESEND_AFTER_SECONDS);
          onPending(true);
          track("booking_code_sent", { section: "booking-form" });
        }
      } else if (state.status === "invalid") {
        onFieldErrors({ name: state.errors.fullName, phone: state.errors.phone });
        failed("invalid", null);
      } else if (state.status === "unavailable") {
        failed("unavailable", t.unavailable);
      } else if (state.status === "error") {
        failed("send", state.message);
      }
    });
  };

  const verify = useCallback(
    (code: string) => {
      if (!sent) return;
      setCodeError(null);
      setProblem(null);
      const fd = new FormData();
      fd.set("otpPhone", sent.phone);
      fd.set("otpCode", code);
      startTransition(async () => {
        const state = await verifyBookingCodeAction(IDLE, fd);
        if (state.status === "signed-in") {
          track("booking_code_verified", { section: "booking-form" });
          callbacks.current.onPending(false);
          callbacks.current.onVerified(state.phone, state.newUser);
        } else if (state.status === "code-sent") {
          if (state.errors?.code) {
            setCodeError(state.errors.code);
            track("booking_verify_failed", { reason: "code" });
          } else {
            track("booking_verify_failed", { reason: "verify" });
            setProblem(state.message ?? null);
          }
        } else if (state.status === "unavailable") {
          track("booking_verify_failed", { reason: "unavailable" });
          setProblem(t.unavailable);
        } else if (state.status === "error") {
          track("booking_verify_failed", { reason: "verify" });
          setProblem(state.message);
        } else if (state.status === "invalid") {
          track("booking_verify_failed", { reason: "invalid" });
          setProblem(state.errors.phone ?? null);
        }
      });
    },
    [sent, t.unavailable],
  );

  // Resend countdown and the Android SMS autofill (WebOTP; the SMS ends "@www.velto.com.bd #123456"), once a code is out.
  useEffect(() => {
    if (!sent) return;
    const timer = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    codeRef.current?.focus();
    const abort = new AbortController();
    if ("OTPCredential" in window) {
      (navigator.credentials.get({ otp: { transport: ["sms"] }, signal: abort.signal } as CredentialRequestOptions) as Promise<{ code?: string } | null>)
        .then((otp) => {
          if (otp?.code && codeRef.current) {
            codeRef.current.value = otp.code;
            verify(otp.code);
          }
        })
        .catch(() => {});
    }
    return () => {
      clearInterval(timer);
      abort.abort();
    };
  }, [sent, verify]);

  const changeNumber = () => {
    setSent(null);
    setProblem(null);
    setCodeError(null);
    onPending(false);
    document.getElementById("booking-phone")?.focus();
  };

  const link = "font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue";
  const button = "inline-flex h-12 items-center justify-center rounded-md px-6 text-base font-semibold leading-none transition-colors disabled:opacity-60";

  return (
    <div className="rounded-lg border border-line bg-soft p-4 md:p-5" data-booking-verify={sent ? "code" : "send"}>
      {notice ? (
        <p role="alert" className="mb-3 font-semibold text-error">
          {notice}
        </p>
      ) : null}
      {problem ? (
        <div role="alert" className="mb-3 space-y-3">
          <p className="font-semibold text-error">{problem}</p>
          <p className="t-small text-secondary">{t.callbackHint}</p>
          {fallback}
        </div>
      ) : null}
      {!sent ? (
        <div className="space-y-3">
          <button type="button" onClick={() => send()} disabled={busy} className={`${button} w-full bg-action text-white hover:bg-action/90 sm:w-auto`} data-verify-send>
            {busy ? t.sending : t.send}
          </button>
          <p className="t-small text-secondary">
            {t.termsBefore}
            <Link href="/terms" target="_blank" className={link}>
              {t.termsLink}
            </Link>
            {t.and}
            <Link href="/privacy" target="_blank" className={link}>
              {t.privacyLink}
            </Link>
            {t.termsAfter}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-body">
            {t.sentBefore}
            <strong className="whitespace-nowrap text-navy">{displayBdPhone(sent.phone)}</strong>
            {t.sentAfter}
          </p>
          {resent && !problem ? <p className="t-small font-semibold text-success">{t.resent}</p> : null}
          <div>
            <label htmlFor="booking-code" className="block text-[15px] font-semibold text-navy">
              {t.codeLabel}
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                ref={codeRef}
                id="booking-code"
                name="otpCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                enterKeyHint="done"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    verify(e.currentTarget.value);
                  }
                }}
                aria-invalid={codeError ? true : undefined}
                aria-describedby={codeError ? "booking-code-error" : undefined}
                className="block h-[54px] w-full rounded-md border border-line-strong bg-white px-4 text-base tracking-[0.2em] text-navy focus:border-blue focus:outline-1 focus:outline-offset-0 focus:outline-blue aria-[invalid=true]:border-error sm:max-w-[200px] md:h-[52px]"
              />
              <button type="button" onClick={() => verify(codeRef.current?.value ?? "")} disabled={busy} className={`${button} bg-action text-white hover:bg-action/90`} data-verify-check>
                {busy ? t.verifying : t.verify}
              </button>
            </div>
            {codeError ? (
              <p id="booking-code-error" role="alert" className="mt-2 t-small font-semibold text-error">
                {codeError}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 t-small">
            <button type="button" onClick={changeNumber} className={link}>
              {t.change}
            </button>
            {left > 0 ? (
              <span className="text-secondary">{fill(t.resendIn, { s: left }, locale)}</span>
            ) : (
              <button type="button" onClick={() => send(true)} disabled={busy} className={link}>
                {t.resend}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
