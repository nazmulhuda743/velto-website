"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/app/controls";
import { buttonClass } from "@/components/app/ui";
import { currentSubscription, permission, pushSupport, subscribe } from "@/lib/push/client";
import type { PushPrefs } from "@/lib/push/prefs";
import { announceSaved } from "./SavedFlag";

const KEYS: (keyof PushPrefs)[] = ["orderUpdates", "pickupUpdates", "careUpdates", "paymentUpdates", "reminders", "offers"];

/**
 * Profile › Notifications: one switch per kind of message, saved as soon as it is flipped (the
 * account keeps them for every phone). If this phone isn't receiving yet, one button turns it on.
 */
export function NotificationsForm({ initial, lang, t }: { initial: PushPrefs; lang: "en" | "bn"; t: { rows: Record<string, [string, string]>; phoneOff: string; turnOn: string } }) {
  const [prefs, setPrefs] = useState(initial);
  const [phoneOn, setPhoneOn] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const on = pushSupport() === "ok" && permission() === "granted" && Boolean(await currentSubscription());
      if (live) setPhoneOn(on);
    })();
    return () => {
      live = false;
    };
  }, []);

  async function flip(key: keyof PushPrefs, value: boolean) {
    setPrefs((p) => ({ ...p, [key]: value }));
    const r = await fetch("/api/push/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "prefs", [key]: value }) }).catch(() => null);
    if (r?.ok) announceSaved();
    else setPrefs((p) => ({ ...p, [key]: !value }));
  }

  return (
    <div className="space-y-4" data-app-notifications>
      {phoneOn === false && pushSupport() === "ok" && permission() !== "denied" ? (
        <div className="space-y-2.5 rounded-2xl bg-app-tint p-4">
          <p className="a-sec text-navy">{t.phoneOff}</p>
          <button type="button" className={buttonClass("primary", "!h-11")} onClick={async () => setPhoneOn((await subscribe(lang)).ok)}>
            {t.turnOn}
          </button>
        </div>
      ) : null}
      <div className="rounded-2xl border border-line bg-app-card px-4">
        {KEYS.map((k) => (
          <div key={k} className="border-b border-line last:border-b-0">
            <Switch checked={prefs[k]} onChange={(v) => flip(k, v)} label={t.rows[k][0]} sub={t.rows[k][1]} />
          </div>
        ))}
      </div>
    </div>
  );
}
