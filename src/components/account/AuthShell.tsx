import type { ReactNode } from "react";
import Link from "@/components/i18n/Link";
import { accountText } from "@/content/i18n/account";
import { getLocale } from "@/lib/i18n/server";

type Mode = "signin" | "signup";

/** Frame for sign-in, sign-up and password pages: calm, one task per screen. */
export async function AuthShell({
  title,
  intro,
  mode,
  next,
  children,
}: {
  title: string;
  intro?: ReactNode;
  /** Shows the Sign in | Create account switch at the top of the card. */
  mode?: Mode;
  next?: string;
  children: ReactNode;
}) {
  const t = accountText(await getLocale()).shell;
  const query = next && next !== "/account" ? `?next=${encodeURIComponent(next)}` : "";
  const tabs: { mode: Mode; href: string; label: string }[] = [
    { mode: "signin", href: `/login${query}`, label: t.tabSignIn },
    { mode: "signup", href: `/signup${query}`, label: t.tabSignUp },
  ];
  return (
    <section aria-labelledby="page-title" className="bg-warm py-10 md:py-16 xl:py-20">
      <div className="container-page grid gap-10 xl:grid-cols-12 xl:gap-8">
        <div className="xl:col-span-6 xl:col-start-2">
          <div className="mx-auto max-w-[480px] xl:mx-0">
            <h1 id="page-title" className="t-h1 text-navy">
              {title}
            </h1>
            {intro ? <div className="mt-3 t-body-lg text-body">{intro}</div> : null}
            <div className="mt-8 rounded-lg border border-line bg-white p-5 shadow-[0_12px_32px_-24px_rgba(0,43,78,0.35)] md:p-8">
              {mode ? (
                <nav aria-label={t.tabsLabel} className="mb-6">
                  <ul className="grid grid-cols-2 gap-1 rounded-md bg-soft p-1">
                    {tabs.map((tab) => {
                      const active = tab.mode === mode;
                      return (
                        <li key={tab.mode}>
                          <Link
                            href={tab.href}
                            aria-current={active ? "page" : undefined}
                            className={`flex h-11 items-center justify-center rounded-[6px] px-3 text-center font-semibold transition-colors ${
                              active ? "bg-white text-navy shadow-[0_1px_3px_rgba(0,43,78,0.18)]" : "text-body hover:text-navy"
                            }`}
                          >
                            {tab.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              ) : null}
              {children}
            </div>
            <ul aria-label={t.asideLabel} className="mt-6 space-y-3 xl:hidden">
              {t.points.map((p) => (
                <li key={p.title} className="flex gap-3 t-small text-body">
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 size-4 shrink-0 text-action">
                    <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>
                    <span className="block font-semibold text-navy">{p.title}</span>
                    {p.copy}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <aside aria-label={t.asideLabel} className="hidden xl:col-span-4 xl:col-start-8 xl:block">
          <div className="sticky top-[120px] rounded-lg bg-navy p-8 text-white">
            <p className="t-label uppercase text-cyan">{t.yourAccount}</p>
            <ul className="mt-6 space-y-6">
              {t.points.map((p) => (
                <li key={p.title} className="border-t border-white/15 pt-5 first:border-0 first:pt-0">
                  <p className="font-semibold">{p.title}</p>
                  <p className="mt-1 t-small text-white/75">{p.copy}</p>
                </li>
              ))}
            </ul>
            <p className="mt-8 t-small text-white/70">{t.stillWorks}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
