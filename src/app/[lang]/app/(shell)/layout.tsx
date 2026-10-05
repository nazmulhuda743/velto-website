import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppScreen } from "@/components/app/AppScreen";
import { accountGate } from "@/components/account/AccountGate";
import { Analytics } from "@/components/layout/Analytics";
import { AppInstalledMark } from "@/components/pwa/AppInstalledMark";
import { AppTabBar } from "@/components/pwa/AppTabBar";
import { formText } from "@/content/i18n/forms";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Velto", robots: { index: false, follow: false } };

/**
 * The installed app's own shell (manifest scope "/app/"): each screen (its own header and content), the tab bar.
 * No website component loads here (no menu, footer, promo bar, popups, cookie banner, breadcrumbs),
 * so nothing from the website can appear in the app. Every screen needs a customer session; the
 * same states as the website's account (unavailable, staff, welcome back, unfinished profile) come
 * from AccountGate.
 */
export default async function AppShellLayout({ children }: { children: ReactNode }) {
  const gate = await accountGate("/app");
  const t = formText(await getLocale()).common.appBar;
  return (
    <div className="min-h-dvh bg-warm pb-[calc(64px+env(safe-area-inset-bottom))]" data-app-shell>
      {/* Each screen draws its own header (AppScreen); a gate screen gets the plain logo one. */}
      {gate.screen ? <AppScreen>{gate.screen}</AppScreen> : children}
      {gate.screen ? null : <AppTabBar t={t} />}
      <Analytics />
      <AppInstalledMark />
    </div>
  );
}
