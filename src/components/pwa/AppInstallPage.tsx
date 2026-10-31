"use client";

import { useEffect, useState, type ReactNode } from "react";
import { buttonClass } from "@/components/app/ui";
import { track } from "@/components/layout/Analytics";
import type { FormText } from "@/content/i18n/forms/en";
import { chromeSaysInstalled, deviceInfo, installedOnThisPhone, isStandalone } from "@/lib/pwa/install-detect";
import { takeInstallPrompt, useHasInstallPrompt } from "@/lib/pwa/install-prompt";
import { ShareGlyph } from "./ShareGlyph";

type View = "checking" | "installed" | "prompt" | "ios" | "inapp-android" | "inapp-ios" | "android-wait" | "desktop" | "added";

/** Chrome on Android opens this from inside Facebook / WhatsApp / Instagram browsers. */
function chromeIntent() {
  const here = `${location.host}${location.pathname}`;
  return `intent://${here}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(location.href)};end`;
}

/**
 * The /app screen. Decides what this phone can do and shows only that:
 * one tap on Android Chrome, Share → Add to Home Screen on iPhone Safari, "open in Chrome" from an
 * in-app browser, and nothing to install when Velto is already on the phone.
 */
export function AppInstallPage({ t, install, accountHref, logo }: { t: FormText["common"]["appPage"]; install: FormText["common"]["install"]; /** "Continue in the browser": the website's account. */ accountHref: string; logo?: ReactNode }) {
  const hasPrompt = useHasInstallPrompt();
  const [view, setView] = useState<View>("checking");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      // Opened inside the installed app: its own home, not the website.
      location.replace("/app/home");
      return;
    }
    let cancelled = false;
    let waitTimer: number | undefined;
    (async () => {
      const { isIOS, inApp, isAndroid } = deviceInfo();
      let next: View;
      if (installedOnThisPhone() || (await chromeSaysInstalled())) next = "installed";
      else if (hasPrompt) next = "prompt";
      else if (inApp) next = isIOS ? "inapp-ios" : "inapp-android";
      else if (isIOS) next = "ios";
      else if (isAndroid) next = "android-wait";
      else next = "desktop";
      if (cancelled) return;
      const show = () => {
        if (cancelled) return;
        setView((v) => (v === "added" ? v : next));
        track(next === "ios" ? "install_ios_shown" : "install_prompt_shown", { placement: "app_link", detail: next });
      };
      // Android Chrome can hand over its install prompt a few seconds after the page loads. Wait for
      // it quietly instead of showing a menu hint that the one-tap button is about to replace.
      if (next === "android-wait") waitTimer = window.setTimeout(show, 5000);
      else show();
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(waitTimer);
    };
  }, [hasPrompt]);

  const installNow = async () => {
    const prompt = takeInstallPrompt();
    if (!prompt) return;
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      track(outcome === "accepted" ? "install_accepted" : "install_dismissed", { placement: "app_link", detail: "prompt" });
      if (outcome === "accepted") setView("added");
    } catch {
      /* the browser refused; the page stays as it is */
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
    } catch {
      /* clipboard blocked: the address bar still has the link */
    }
  };

  const primary = buttonClass("primary");

  return (
    <main className="flex min-h-[100dvh] flex-col bg-warm px-6 pb-[calc(32px+env(safe-area-inset-bottom))] pt-[calc(20px+env(safe-area-inset-top))]" data-app-entry data-app-link={view}>
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col">
        {logo}
        <div className="flex flex-1 flex-col justify-center gap-4 py-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" width={72} height={72} className="size-[72px] rounded-[18px]" />
          <h1 className="a-title a-entry">{view === "installed" ? t.installed : t.title}</h1>
          <p className="a-row text-secondary">{view === "installed" ? t.installedBody : view === "added" ? install.added : t.body}</p>
          {view === "ios" ? (
            <p className="mt-2 flex items-center gap-3 rounded-xl border border-line bg-app-card px-4 py-3.5 a-body text-body">
              <ShareGlyph className="size-[22px] shrink-0 text-action" />
              {t.iosLine}
            </p>
          ) : view === "inapp-ios" ? (
            <p className="mt-2 a-body text-secondary">{t.inAppIos}</p>
          ) : view === "android-wait" ? (
            <p className="mt-2 a-sec text-muted">{t.chromeMenu}</p>
          ) : view === "desktop" ? (
            <p className="mt-2 a-body text-secondary">{t.desktop}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          {view === "prompt" ? (
            <button type="button" onClick={installNow} className={primary} data-install-button>
              {t.install}
            </button>
          ) : view === "inapp-android" ? (
            <a href={chromeIntent()} className={primary}>
              {t.openChrome}
            </a>
          ) : view === "inapp-ios" ? (
            <button type="button" onClick={copyLink} className={primary}>
              {copied ? t.copied : t.copy}
            </button>
          ) : null}
          {view !== "checking" ? (
            <a href={accountHref} className={buttonClass("text", "a-body")}>
              {t.continueWeb}
            </a>
          ) : null}
        </div>
      </div>
    </main>
  );
}
