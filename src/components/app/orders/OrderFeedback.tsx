"use client";

import { useActionState, type ReactNode } from "react";
import { saveFeedbackAction, type FeedbackState } from "@/lib/customer/actions";
import { buttonClass, whatsappHref } from "@/components/app/ui";

type Text = { feedbackTitle: string; allGood: string; somethingOff: string; feedbackNote: string };

/**
 * "How did we do?" on a delivered order. "All good" stores a private flag (the existing private
 * feedback record, rating 5, never shown publicly); "Something was off" opens WhatsApp with the
 * order number, so a person handles it. After "All good" the thank-you (and weekly offer) shows.
 */
export function OrderFeedback({ orderNumber, offText, t, thanks }: { orderNumber: string; offText: string; t: Text; thanks: ReactNode }) {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(saveFeedbackAction, { status: "idle" });
  if (state.status === "saved") return <>{thanks}</>;
  const btn = buttonClass("secondary", "!h-11 flex-1 !px-3 !text-[14px]");
  return (
    <section aria-labelledby="app-feedback" className="rounded-2xl border border-line bg-app-card p-4" data-app-feedback>
      <h2 id="app-feedback" className="a-body font-semibold text-navy">
        {t.feedbackTitle}
      </h2>
      <form action={action} className="mt-2.5 flex gap-2.5">
        <input type="hidden" name="orderNumber" value={orderNumber} />
        <input type="hidden" name="rating" value="5" />
        <button type="submit" className={btn} disabled={pending}>
          {t.allGood}
        </button>
        <a href={whatsappHref(offText)} target="_blank" rel="noopener noreferrer" className={btn} data-analytics="whatsapp_click" data-placement="feedback_off">
          {t.somethingOff}
        </a>
      </form>
      {state.status === "error" ? (
        <p role="alert" className="mt-2 a-cap text-app-red">
          {state.message}
        </p>
      ) : null}
      <p className="mt-2.5 text-[12.5px] leading-snug text-muted">{t.feedbackNote}</p>
    </section>
  );
}
