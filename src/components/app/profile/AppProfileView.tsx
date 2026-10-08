import { redirect } from "next/navigation";
import { Card, ListRow, WhatsAppButton } from "@/components/app/ui";
import { accountText } from "@/content/i18n/account";
import { formText } from "@/content/i18n/forms";
import { signOutAction } from "@/lib/customer/actions";
import { getCustomerSession, getPreferences } from "@/lib/customer/portal";
import { getRoutine } from "@/lib/customer/routine";
import { displayBdPhone } from "@/lib/customer/validation";
import { banglaEnabled, fill, format, localizeHref } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { DEFAULT_PUSH_PREFS, pushPrefsFromStatus, type PushPrefs } from "@/lib/push/prefs";
import { getSiteContent } from "@/lib/site-content";
import { supabaseRpc } from "@/lib/supabase-server";

/**
 * Profile (design "Profile (settings list)"): name, number and Verified, then one row per setting
 * (each opens its own screen that saves as you go), help on WhatsApp, the legal pages, sign out.
 */
export async function AppProfileView() {
  const session = await getCustomerSession();
  if (session.kind !== "customer" || session.account.state !== "ready") redirect("/app/login?next=/app/profile");
  const a = session.account;
  const locale = await getLocale();
  const fm = formText(locale);
  const t = fm.common.app;
  const at = accountText(locale);
  const [prefs, routine, push, { loyalty }] = await Promise.all([
    getPreferences(),
    getRoutine(),
    supabaseRpc<{ devices: number } & Partial<PushPrefs>>("website_push_status", { p_auth_user_id: session.user.id }).catch(() => null),
    getSiteContent(),
  ]);
  const verified = a.phoneVerified || a.link.status === "linked";

  const labels = prefs.addresses.map((x) => x.label).filter(Boolean);
  const addressesSub = prefs.addresses.length ? fill(labels.length ? t.addressesSub : t.addressesSubPlain, { n: prefs.addresses.length, labels: labels.join(", ") }, locale) : t.addressesNone;
  const prefsSub = prefs.care.shirts === "hanger" ? t.prefsSubHanger : prefs.care.shirts === "folded" ? t.prefsSubFolded : t.noPref;
  const r = routine === "error" ? null : routine;
  const weeklySub =
    !r || r.status === "stopped" || r.status === "declined"
      ? t.weeklyOff
      : r.status === "requested"
        ? t.weeklyRequested
        : r.status === "paused"
          ? t.weeklyPaused
          : format(at.routine.activeTitle, { day: fm.bookPage.routineDays[r.weekday], time: fm.booking.slots[r.window] });
  const p = pushPrefsFromStatus(push) ?? DEFAULT_PUSH_PREFS;
  const all = Object.values(p).every(Boolean);
  const defaults = (Object.keys(DEFAULT_PUSH_PREFS) as (keyof PushPrefs)[]).every((k) => p[k] === DEFAULT_PUSH_PREFS[k]);
  const notifSub = !push?.devices ? t.notifOff : all ? t.notifAll : defaults ? t.notifDefault : t.notifSome;

  return (
    <div data-app-profile>
      <header className="space-y-1">
        <h1 className="a-title">{a.fullName}</h1>
        <p className="a-body text-muted">
          {displayBdPhone(a.phone)}
          {verified ? (
            <>
              {" · "}
              <span className="font-semibold text-app-green">{t.verified}</span>
            </>
          ) : null}
        </p>
      </header>

      <nav aria-label={fm.common.appBar.profile} className="mt-5 overflow-hidden rounded-2xl border border-line bg-app-card">
        <ListRow href="/app/profile/details" title={t.pDetails} sub={t.pDetailsSub} />
        <ListRow href="/app/profile/addresses" title={t.pAddresses} sub={addressesSub} />
        <ListRow href="/app/profile/preferences" title={t.pPrefs} sub={prefsSub} />
        <ListRow href="/app/profile/weekly" title={t.pWeekly} sub={weeklySub} />
        <ListRow href="/app/profile/notifications" title={t.pNotif} sub={notifSub} />
        {banglaEnabled() ? <ListRow href="/app/profile/language" title={t.pLang} sub={t.langNames[locale]} /> : null}
        {loyalty.enabled || loyalty.goal.enabled ? <ListRow href="/app/rewards" title={t.rewards} /> : null}
      </nav>

      <Card className="mt-4 flex items-center justify-between gap-3 !border-0 !bg-app-tint !px-4 !py-3.5">
        <div className="min-w-0">
          <h2 className="a-sec font-semibold text-navy">{t.helpWa}</h2>
          <p className="a-cap text-secondary">{t.supportHours}</p>
        </div>
        <WhatsAppButton placement="app_profile_help" className="!h-11 !w-auto shrink-0 !px-3.5 !text-[14px]">
          WhatsApp
        </WhatsAppButton>
      </Card>

      <div className="mt-6 flex gap-4 a-cap text-muted">
        <a href={localizeHref("/privacy", locale)} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
          {t.privacy}
        </a>
        <a href={localizeHref("/terms", locale)} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
          {t.terms}
        </a>
      </div>
      <form action={signOutAction}>
        <input type="hidden" name="base" value="/app" />
        <button type="submit" className="inline-flex min-h-11 items-center a-body font-semibold text-app-red">
          {t.signOut}
        </button>
      </form>
    </div>
  );
}
