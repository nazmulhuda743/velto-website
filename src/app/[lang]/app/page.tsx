import type { Metadata } from "next";
import { AppInstallPage } from "@/components/pwa/AppInstallPage";
import { Logo } from "@/components/ui/Logo";
import { formText } from "@/content/i18n/forms";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Velto app", robots: { index: false, follow: false } };

/**
 * velto.com.bd/app: the link in Velto's WhatsApp messages. A clean screen with one job, getting
 * Velto onto the customer's phone. No website around it and no sign-in first: on iPhone the app
 * keeps its own sign-in, so signing in here first would mean signing in twice. Opened inside the
 * app, it goes straight to the account.
 */
export default async function AppLinkPage() {
  const locale = await getLocale();
  const c = formText(locale).common;
  return <AppInstallPage t={c.appPage} install={c.install} accountHref={locale === "bn" ? "/bn/account" : "/account"} logo={<Logo className="h-6 w-auto self-start" />} />;
}
