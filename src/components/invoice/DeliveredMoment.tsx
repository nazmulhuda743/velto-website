"use client";

import { useId, useState } from "react";
import type { InvoiceText } from "@/content/i18n/invoice";
import type { AccountText } from "@/content/i18n/account";
import { FEEDBACK_ISSUES, happy } from "@/lib/customer/extras";
import { DEFAULT_ROUTINE, inviteKind, WINDOWS, type NextService, type RoutineWindow } from "@/lib/second-service";

type Moment = InvoiceText["moment"];
type Fb = AccountText["feedback"];
type Status = "idle" | "sending" | "done" | "error";

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-10">
      <path d="m12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8L12 3.2Z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const chip =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-line-strong px-4 t-small font-semibold text-navy has-[:checked]:border-action has-[:checked]:bg-[#e8f3fb] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-action";

async function send(code: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`/api/invoice/${code}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return Boolean(res.ok && data?.ok);
  } catch {
    return false;
  }
}

/**
 * The delivered moment (docs/technical/SECOND-SERVICE.md): the last impression of an order
 * (peak-end), then one next service. Dry-cleaning-only customers pick a weekly day for the habit
 * (implementation intention); everyday customers add a service to the pickup they already have
 * (habit stacking). Every tap is one request; staff confirm by phone.
 */
export function DeliveredMoment({
  code,
  preview,
  title,
  trusted,
  existingRating,
  next,
  prices,
  asked,
  googleUrl,
  t,
  fb,
  digits,
}: {
  code: string;
  preview: boolean;
  title: string;
  trusted: string | null;
  existingRating: number | null;
  next: NextService | null;
  prices: { item: string; price: string }[];
  /** A request already made from this link: shown as done. */
  asked: { weekday: number | null; window: string | null } | null;
  googleUrl: string;
  t: Moment;
  fb: Fb;
  digits: string[];
}) {
  const name = useId();
  const [rating, setRating] = useState(existingRating ?? 0);
  const [issues, setIssues] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [rateStatus, setRateStatus] = useState<Status>(existingRating ? "done" : "idle");
  const [weekday, setWeekday] = useState(asked?.weekday ?? DEFAULT_ROUTINE.weekday);
  const [slot, setSlot] = useState<RoutineWindow>((WINDOWS as readonly string[]).includes(asked?.window ?? "") ? (asked!.window as RoutineWindow) : DEFAULT_ROUTINE.window);
  const [askStatus, setAskStatus] = useState<Status>(asked ? "done" : "idle");

  const words = (template: string) => template.replace("{day}", t.days[weekday]).replace("{window}", t.windows[slot]);

  const submitRating = async (value: number, withDetails: boolean) => {
    setRating(value);
    // Happy: one tap saves. Unhappy: wait for what went wrong (sent with the button).
    if (!withDetails && !happy(value)) return;
    setRateStatus("sending");
    const ok = preview ? true : await send(code, { action: "rate", rating: value, issues: happy(value) ? [] : issues, comment: comment.trim() || null });
    setRateStatus(ok ? "done" : "error");
  };

  const submitAsk = async () => {
    if (!next) return;
    setAskStatus("sending");
    const kind = inviteKind(next);
    const ok = preview ? true : await send(code, kind === "routine" ? { action: "routine", service: next, weekday, window: slot } : { action: "addon", service: next });
    setAskStatus(ok ? "done" : "error");
  };

  const kind = next ? inviteKind(next) : null;
  return (
    <div className="space-y-6 print:hidden" data-delivered-moment={next ?? "none"}>
      <div>
        <h2 className="font-serif text-[28px] leading-[1.15] text-navy md:text-[32px]">{title}</h2>
        {trusted ? <p className="mt-2 text-body">{trusted}</p> : null}
      </div>

      {/* 1. Close the loop. */}
      <section aria-labelledby={`${name}-rate`} className="rounded-lg border border-line p-4 md:p-5" data-moment-rate={rateStatus}>
        <h3 id={`${name}-rate`} className="font-semibold text-navy">
          {t.rate}
        </h3>
        {rateStatus === "done" ? (
          <div role="status" className="mt-2">
            <div className="flex gap-1 text-[#f5a623]" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} filled={n <= rating} />
              ))}
            </div>
            <p className="mt-2 font-semibold text-navy">{happy(rating) ? fb.thanksHappy : fb.thanksUnhappy}</p>
            {happy(rating) ? (
              <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md border border-line-strong px-4 t-small font-semibold text-navy hover:border-navy">
                {fb.googleButton}
              </a>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mt-2 flex gap-1" role="radiogroup" aria-labelledby={`${name}-rate`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${fb.starLabel.replace("{n}", digits[n - 1])}, ${fb.stars[n - 1]}`}
                  disabled={rateStatus === "sending"}
                  onClick={() => submitRating(n, false)}
                  className="rounded-md text-[#f5a623] focus-visible:ring-2 focus-visible:ring-action"
                >
                  <Star filled={n <= rating} />
                </button>
              ))}
            </div>
            {rating && !happy(rating) ? (
              <div className="mt-4 space-y-4">
                <fieldset>
                  <legend className="t-small font-semibold text-navy">{fb.whatWrong}</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {FEEDBACK_ISSUES.map((issue) => (
                      <label key={issue} className={chip}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={issues.includes(issue)}
                          onChange={(e) => setIssues((list) => (e.target.checked ? [...list, issue] : list.filter((i) => i !== issue)))}
                        />
                        {fb.issues[issue]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <textarea
                  aria-label={fb.comment}
                  rows={3}
                  maxLength={1000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={fb.commentPlaceholder}
                  className="block w-full rounded-md border border-line-strong bg-white px-4 py-3 text-base text-navy placeholder:text-muted focus:border-action focus:ring-2 focus:ring-action/30"
                />
                <button
                  type="button"
                  disabled={rateStatus === "sending"}
                  onClick={() => submitRating(rating, true)}
                  className="inline-flex min-h-12 items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover disabled:opacity-60"
                >
                  {rateStatus === "sending" ? fb.sending : fb.submit}
                </button>
              </div>
            ) : null}
            {rateStatus === "error" ? (
              <p role="alert" className="mt-2 t-small font-medium text-error">
                {t.failed}
              </p>
            ) : null}
          </>
        )}
      </section>

      {/* 2. One next service. */}
      {next && kind ? (
        <section aria-labelledby={`${name}-next`} className="rounded-lg bg-soft p-4 md:p-6" data-moment-next={next}>
          <h3 id={`${name}-next`} className="text-[20px] font-semibold leading-snug text-navy">
            {t[`${next}Title`]}
          </h3>
          <p className="mt-1.5 t-small text-body">{t[`${next}Body`]}</p>
          {prices.length ? (
            <>
              <ul className="mt-4 grid grid-cols-2 gap-2">
                {prices.map((p) => (
                  <li key={p.item} className="flex items-baseline justify-between gap-2 rounded-md bg-white px-3 py-2.5">
                    <span className="truncate t-small text-navy">{p.item}</span>
                    <span className="shrink-0 font-semibold text-navy">{p.price}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 t-caption text-secondary">{t.pricesNote}</p>
            </>
          ) : null}

          {askStatus === "done" ? (
            <p role="status" className="mt-5 rounded-md bg-white p-4 font-semibold text-navy" data-moment-asked>
              {kind === "routine" ? words(t.routineDone) : t.addonDone}
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {kind === "routine" ? (
                <>
                  <fieldset>
                    <legend className="t-small font-semibold text-navy">{t.pickDay}</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {t.days.map((d, i) => (
                        <label key={d} className={chip}>
                          <input type="radio" name={`${name}-day`} className="sr-only" checked={weekday === i} onChange={() => setWeekday(i)} />
                          {d}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="t-small font-semibold text-navy">{t.pickWindow}</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {WINDOWS.map((w) => (
                        <label key={w} className={chip}>
                          <input type="radio" name={`${name}-window`} className="sr-only" checked={slot === w} onChange={() => setSlot(w)} />
                          {t.windowChips[w]}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </>
              ) : null}
              <button
                type="button"
                disabled={askStatus === "sending"}
                onClick={submitAsk}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover disabled:opacity-60 sm:w-auto"
              >
                {kind === "routine" ? words(t.routineButton) : t.addonButton}
              </button>
              {askStatus === "error" ? (
                <p role="alert" className="t-small font-medium text-error">
                  {t.failed}
                </p>
              ) : null}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
