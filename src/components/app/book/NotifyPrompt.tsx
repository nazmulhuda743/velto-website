"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/app/ui";
import { track } from "@/components/layout/Analytics";
import { currentSubscription, permission, pushSupport, subscribe } from "@/lib/push/client";

/**
 * "Get updates on this phone" after the first booking (design "Book success"). Shown only where
 * the phone can take notifications and they aren't on or refused already. Turning on keeps the
 * defaults (order, pickup, care, payment and reminders on; offers off).
 */
export function NotifyPrompt({ lang, t }: { lang: "en" | "bn"; t: { title: string; body: string; on: string; later: string } }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      if (pushSupport() !== "ok" || permission() === "denied") return;
      if (permission() === "granted" && (await currentSubscription())) return;
      if (live) setShow(true);
    })();
    return () => {
      live = false;
    };
  }, []);

  if (!show) return null;
  return (
    <section aria-labelledby="app-notify" className="space-y-2.5 rounded-2xl border border-line bg-app-card p-[18px]" data-app-notify>
      <h2 id="app-notify" className="a-row font-semibold text-navy">
        {t.title}
      </h2>
      <p className="a-sec text-secondary">{t.body}</p>
      <div className="flex gap-2.5">
        <button
          type="button"
          disabled={busy}
          className={buttonClass("primary", "!h-[46px] flex-1 !text-[15px]")}
          onClick={async () => {
            setBusy(true);
            track("notify_prompt", { placement: "app_book_success" });
            const r = await subscribe(lang);
            setBusy(false);
            if (r.ok) track("notify_on", { placement: "app_book_success" });
            else if (r.reason === "denied") track("notify_denied", { placement: "app_book_success" });
            setShow(false);
          }}
        >
          {t.on}
        </button>
        <button type="button" className={buttonClass("secondary", "!h-[46px] flex-1 !text-[15px]")} onClick={() => setShow(false)}>
          {t.later}
        </button>
      </div>
    </section>
  );
}
