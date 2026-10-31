import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppScreen } from "@/components/app/AppScreen";
import { AppHeader } from "@/components/pwa/AppHeader";
import { formText } from "@/content/i18n/forms";
import { getCustomerSession } from "@/lib/customer/portal";
import { getLocale } from "@/lib/i18n/server";
import { SavedFlag } from "./SavedFlag";

/** The signed-in customer for a Profile sub-screen (or the app's sign-in, coming back here). */
export async function profileSession(path: string) {
  const session = await getCustomerSession();
  if (session.kind !== "customer" || session.account.state !== "ready") redirect(`/app/login?next=${encodeURIComponent(path)}`);
  return session;
}

/** A Profile sub-screen: "← Profile" and "Saved" on top, the title and its line, the settings, a footnote. */
export async function SubScreen({ title, sub, foot, children }: { title: string; sub?: string; foot?: string; children: ReactNode }) {
  const f = formText(await getLocale()).common;
  return (
    <AppScreen header={<AppHeader back={{ href: "/app/profile", label: f.appBar.profile }} actions={<SavedFlag label={f.app.saved} />} />}>
      <header className="space-y-1.5">
        <h1 className="a-title !text-[26px]">{title}</h1>
        {sub ? <p className="a-sec text-muted">{sub}</p> : null}
      </header>
      <div className="mt-5">{children}</div>
      {foot ? <p className="mt-4 a-cap text-muted">{foot}</p> : null}
    </AppScreen>
  );
}
