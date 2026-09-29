"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { saveFeedbackAction, type FeedbackState } from "@/lib/customer/actions";
import { FEEDBACK_ISSUES, happy, type Feedback } from "@/lib/customer/extras";
import type { AccountText } from "@/content/i18n/account";
import { SubmitButton } from "./SubmitButton";

type Text = AccountText["feedback"];

const IDLE: FeedbackState = { status: "idle" };

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-9 md:size-10">
      <path
        d="m12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8L12 3.2Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Rate a delivered order. Happy (4–5): thanks, and an invitation to say so on Google. Unhappy
 * (1–3): what went wrong goes to the Velto team as a task; the customer is told they'll hear back.
 * Stars are a real radio group, so it works with a keyboard and a screen reader.
 */
export function FeedbackForm({
  orderNumber,
  existing,
  googleUrl,
  t,
  digits,
}: {
  orderNumber: string;
  existing: Feedback | null;
  googleUrl: string;
  t: Text;
  /** "1".."5" in the page language. */
  digits: string[];
}) {
  const [state, action] = useActionState(saveFeedbackAction, IDLE);
  // Editing until a save succeeds; "Change your rating" reopens the form from the current state.
  const [changeFrom, setChangeFrom] = useState<FeedbackState | null>(existing ? null : IDLE);
  const editing = changeFrom !== null && !(state.status === "saved" && state !== changeFrom);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);
  const name = useId();

  useEffect(() => {
    if (state.status === "saved") resultRef.current?.focus();
  }, [state]);

  const saved = state.status === "saved" ? state.rating : null;
  const shown = saved ?? existing?.rating ?? 0;

  if (!editing) {
    const isHappy = happy(shown);
    return (
      <div ref={resultRef} tabIndex={-1} role="status" className="focus:outline-none" data-feedback-result={isHappy ? "happy" : "unhappy"}>
        <div className="flex items-center gap-1 text-[#f5a623]" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} filled={n <= shown} />
          ))}
        </div>
        {saved !== null ? (
          <p className="mt-3 font-semibold text-navy">{isHappy ? t.thanksHappy : t.thanksUnhappy}</p>
        ) : (
          <p className="mt-3 font-semibold text-navy">{t.yourRating.replace("{n}", digits[shown - 1] ?? String(shown))}</p>
        )}
        {isHappy ? (
          <div className="mt-4 rounded-md bg-soft p-4">
            <p className="t-small text-body">{t.googleAsk}</p>
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex h-11 items-center justify-center rounded-md bg-action px-5 font-semibold text-white hover:bg-action-hover"
            >
              {t.googleButton}
            </a>
          </div>
        ) : null}
        {existing?.editable !== false ? (
          <button type="button" onClick={() => setChangeFrom(state)} className="mt-4 t-small font-semibold text-navy underline decoration-blue/50 underline-offset-4">
            {t.change}
          </button>
        ) : null}
      </div>
    );
  }

  const active = hover || rating;
  return (
    <form action={action} className="space-y-5" data-feedback-form>
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <fieldset>
        <legend className="font-semibold text-navy">{t.question}</legend>
        <div className="mt-2 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer rounded-md text-[#f5a623] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-action" onMouseEnter={() => setHover(n)}>
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" required />
              <Star filled={n <= active} />
              <span className="sr-only">
                {t.starLabel.replace("{n}", digits[n - 1])}, {t.stars[n - 1]}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 h-5 t-small font-medium text-secondary" aria-hidden="true">
          {active ? t.stars[active - 1] : ""}
        </p>
      </fieldset>

      {rating && !happy(rating) ? (
        <fieldset>
          <legend className="font-semibold text-navy">{t.whatWrong}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {FEEDBACK_ISSUES.map((issue) => (
              <label key={issue} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line-strong px-4 t-small font-medium text-navy has-[:checked]:border-action has-[:checked]:bg-[#e8f3fb] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-action">
                <input type="checkbox" name="issues" value={issue} defaultChecked={existing?.issues.includes(issue)} className="size-4 accent-[#0078bc]" />
                {t.issues[issue]}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {rating ? (
        <div>
          <label htmlFor={`${name}-comment`} className="block font-semibold text-navy">
            {t.comment}
          </label>
          <textarea
            id={`${name}-comment`}
            name="comment"
            rows={3}
            maxLength={1000}
            defaultValue={existing?.comment ?? ""}
            placeholder={t.commentPlaceholder}
            className="mt-2 block min-h-[96px] w-full rounded-md border border-line-strong bg-white px-4 py-3 text-base text-navy placeholder:text-muted focus:border-action focus:ring-2 focus:ring-action/30"
          />
        </div>
      ) : null}

      {state.status === "error" ? (
        <p role="alert" className="t-small font-medium text-error">
          {state.message}
        </p>
      ) : null}

      {rating ? (
        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton pending={t.sending} className="sm:!w-auto">
            {t.submit}
          </SubmitButton>
          {existing ? <p className="t-small text-secondary">{t.editableUntil}</p> : null}
        </div>
      ) : null}
    </form>
  );
}
