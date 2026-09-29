"use client";

import { useActionState } from "react";
import Link from "@/components/i18n/Link";
import { claimMatchAction, rejectMatchAction, type ClaimState } from "@/lib/customer/actions";
import type { AccountText } from "@/content/i18n/account";
import { SubmitButton } from "./SubmitButton";

type Text = AccountText["welcomeBack"];
const IDLE: ClaimState = { status: "idle" };

/**
 * The moment a verified number meets its Velto history. Before "Continue" nothing personal is
 * shown beyond what the database allows (first name, how many orders, the month of the last
 * one; nothing at all for an older record). "This isn't me" is remembered for good.
 */
export function WelcomeBack({
  kind,
  t,
  title,
  facts,
  showTerms,
  digits,
}: {
  kind: "recent" | "stepup";
  t: Text;
  title: string;
  /** Recent only: "12 previous orders", "Last order · September 2026". */
  facts: string[];
  /** A new account: continuing records the Terms acceptance. */
  showTerms: boolean;
  /** "0".."9" in the page language, for "{n} tries left". */
  digits: string[];
}) {
  const [state, claim] = useActionState(claimMatchAction, IDLE);

  if (state.status === "assisted") {
    return (
      <section aria-labelledby="welcome-title" className="rounded-lg border border-line bg-white p-6 md:p-8" data-welcome-back="assisted">
        <h1 id="welcome-title" className="t-h2 text-navy">
          {t.assistedTitle}
        </h1>
        <p className="mt-3 text-body">{t.assistedBody}</p>
        <Link href="/account" className="mt-6 inline-flex h-12 items-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover">
          {t.continueAnyway}
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="welcome-title" className="rounded-lg border border-line bg-white p-6 shadow-[0_12px_32px_-26px_rgba(0,43,78,0.45)] md:p-8" data-welcome-back={kind}>
      <h1 id="welcome-title" className="text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-navy md:text-[36px]">
        {title}
        {kind === "recent" ? <span aria-hidden="true"> 👋</span> : null}
      </h1>
      <p className="mt-3 text-body">{kind === "recent" ? t.body : t.stepupBody}</p>

      {kind === "recent" && facts.length ? (
        <ul className="mt-5 space-y-1.5 rounded-md bg-soft p-4">
          {facts.map((f) => (
            <li key={f} className="text-[17px] font-semibold text-navy">
              {f}
            </li>
          ))}
        </ul>
      ) : null}

      <form action={claim} className="mt-6 space-y-4">
        {kind === "stepup" ? (
          <label className="block">
            <span className="block text-[15px] font-semibold text-navy">{t.nameLabel}</span>
            <input
              name="name"
              required
              autoComplete="name"
              maxLength={120}
              aria-invalid={state.status === "mismatch" ? true : undefined}
              className="mt-2 block h-12 w-full rounded-md border border-line-strong bg-white px-4 text-base text-navy focus:border-action focus:outline-none focus:ring-2 focus:ring-action/30"
            />
          </label>
        ) : null}
        {state.status === "mismatch" ? (
          <p role="alert" className="t-small font-medium text-error">
            {state.attemptsLeft === 1 ? t.mismatchOne : t.mismatch.replace("{n}", digits[state.attemptsLeft] ?? String(state.attemptsLeft))}
          </p>
        ) : state.status === "error" ? (
          <p role="alert" className="t-small font-medium text-error">
            {state.message}
          </p>
        ) : null}
        <SubmitButton pending={kind === "stepup" ? t.checking : t.opening}>{t.continue}</SubmitButton>
      </form>

      <form action={rejectMatchAction} className="mt-3 text-center">
        <button type="submit" className="inline-flex min-h-11 items-center px-3 font-semibold text-secondary underline decoration-line-strong underline-offset-4 hover:text-navy" data-not-me>
          {t.notMe}
        </button>
      </form>

      {showTerms ? (
        <p className="mt-4 text-center t-caption text-secondary">
          {t.termsBefore}
          <Link href="/terms" target="_blank" className="font-semibold text-navy underline underline-offset-2">
            {t.termsLink}
          </Link>
          {t.termsAnd}
          <Link href="/privacy" target="_blank" className="font-semibold text-navy underline underline-offset-2">
            {t.privacyLink}
          </Link>
          {t.termsAfter}
        </p>
      ) : null}
    </section>
  );
}
