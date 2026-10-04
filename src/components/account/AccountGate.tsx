import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getLocale, loginRedirectPath } from "@/lib/i18n/server";
import { accountText } from "@/content/i18n/account";
import { Alert } from "@/components/account/Alert";
import { ProfileForm } from "@/components/account/forms";
import { StaffAccountNotice } from "@/components/account/SignedInNotice";
import { getCustomerSession, getMatchPreview } from "@/lib/customer/portal";
import { headers } from "next/headers";
import { PATH_HEADER } from "@/lib/app-routes";
import { WelcomeBack } from "@/components/account/WelcomeBack";
import { formText } from "@/content/i18n/forms";
import { fill, localDigits, type Locale } from "@/lib/i18n/config";
import { getSiteContent } from "@/lib/site-content";
import { customerRoutes, type AppBase } from "@/lib/app-routes";
import { signInFor } from "@/lib/app-routes-server";

/** "2026-09" → "September 2026" / "সেপ্টেম্বর ২০২৬". */
function monthLabel(ym: string, locale: Locale) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  if (locale === "en") return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  return `${formText(locale).common.months[m - 1]} ${localDigits(y, locale)}`;
}

/**
 * What a customer page shows before its own content, decided on the server: the account can't
 * load, a staff login, "Welcome back" for a proven number with history, or the unfinished profile.
 * `screen` is that state (shown without the page's navigation); otherwise the page renders, and
 * `rewards` says whether the Rewards section exists. Shared by the website's /account layout and the
 * installed app's shell, so both treat sessions the same way.
 */
export async function accountGate(base: AppBase): Promise<{ screen: ReactNode; rewards: false } | { screen: null; rewards: boolean }> {
  const home = customerRoutes(base).home;
  // The app comes back to the page that was asked for (the proxy passes it on); the website to /account.
  const next = base === "/app" ? ((await headers()).get(PATH_HEADER) ?? home) : home;
  const session = await getCustomerSession();
  if (session.kind === "anonymous") redirect(await signInFor(base, /^\/app(?:\/|$)/.test(next) ? next : home));
  const locale = await getLocale();
  const a = accountText(locale);
  const t = a.layout;

  if (session.kind === "disabled") redirect(base === "/app" ? await signInFor(base, home) : await loginRedirectPath());
  if (session.kind === "unavailable") {
    return {
      rewards: false,
      screen: (
        <>
          <h1 className="t-h2 text-navy">{t.yourAccount}</h1>
          <div className="mt-6">
            <Alert tone="error" title={t.cantLoadTitle}>
              {t.cantLoadBody}
            </Alert>
          </div>
        </>
      ),
    };
  }
  if (session.kind === "staff") {
    return {
      rewards: false,
      screen: (
        <>
          <h1 className="t-h2 text-navy">{t.customerAccount}</h1>
          <div className="mt-6">
            <StaffAccountNotice />
          </div>
        </>
      ),
    };
  }
  if (session.kind !== "customer") redirect(await signInFor(base, home));

  // A proven number with Velto history that this login hasn't decided on yet: "Welcome back"
  // before anything else. Linked accounts never see it again.
  const undecided = session.account.state === "incomplete" || session.account.link.status !== "linked";
  const match = undecided ? await getMatchPreview() : null;
  if (match && (match.state === "recent" || match.state === "stepup")) {
    const w = a.welcomeBack;
    const facts =
      match.state === "recent"
        ? [
            match.orders === 1 ? w.ordersOne : fill(w.orders, { n: match.orders }, locale),
            ...(match.lastOrder ? [fill(w.lastOrder, { month: monthLabel(match.lastOrder, locale) }, locale)] : []),
          ]
        : [];
    return {
      rewards: false,
      screen: (
        <WelcomeBack
          base={base}
          kind={match.state}
          t={w}
          title={match.state === "stepup" ? w.stepupTitle : match.firstName ? fill(w.title, { name: match.firstName }, locale) : w.titleNoName}
          facts={facts}
          showTerms={!match.hasProfile}
          digits={Array.from({ length: 10 }, (_, i) => localDigits(i, locale))}
        />
      ),
    };
  }

  if (session.account.state === "incomplete") {
    // Google sign-ups arrive with their name in the auth metadata; use it as the starting value.
    const meta = session.user.user_metadata ?? {};
    const metaName = typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : "";
    return {
      rewards: false,
      screen: (
        <>
        <h1 className="t-h2 text-navy">{t.finishTitle}</h1>
        <p className="mt-3 text-body">{t.finishBody}</p>
        {match?.state === "assisted" ? (
          <div className="mt-5">
            <Alert tone="info" title={a.welcomeBack.assistedTitle}>
              {a.welcomeBack.assistedBody}
            </Alert>
          </div>
        ) : null}
        <div className="mt-6 rounded-lg border border-line bg-white p-5 md:p-7">
          <ProfileForm
            t={a.forms}
            completing
            phoneLocked={session.account.phoneVerified && session.account.phone ? "verified" : null}
            initial={{ fullName: metaName.trim().slice(0, 80), phone: session.account.phone ?? "", address: "", area: "" }}
          />
        </div>
        </>
      ),
    };
  }
  const { loyalty } = await getSiteContent();
  return { screen: null, rewards: loyalty.enabled || loyalty.goal.enabled };
}
