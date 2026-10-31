"use client";

import { useRouter } from "next/navigation";
import { createContext, startTransition, useContext, type ReactNode } from "react";
import type { FormText } from "@/content/i18n/forms/en";
import { buttonClass, WhatsAppButton } from "./ui";

type Text = Pick<FormText["common"]["app"], "errorTitle" | "errorBody" | "retry"> & { whatsapp: string };

const ErrorText = createContext<{ t: Text; header: ReactNode } | null>(null);

/** The error screen's words and header (the logo is a server component), from the app shell to its error boundary. */
export function AppErrorText({ t, header, children }: { t: Text; header: ReactNode; children: ReactNode }) {
  return <ErrorText.Provider value={{ t, header }}>{children}</ErrorText.Provider>;
}

/**
 * Something failed on the server: the customer's orders are safe, try again or WhatsApp. Shown in
 * place of the screen, under the app's own header and above the tab bar.
 */
export function AppErrorScreen({ reset }: { reset: () => void }) {
  const context = useContext(ErrorText);
  const router = useRouter();
  if (!context) return null;
  const { t, header } = context;
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  return (
    <>
      {header}
      <main id="main" className="mx-auto flex min-h-[60dvh] w-full max-w-[720px] flex-col justify-center gap-3.5 px-5 py-10" role="alert">
        <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-app-red-tint text-[26px] font-bold text-app-red">
          !
        </span>
        <h1 className="a-title text-[26px] leading-[1.2]">{t.errorTitle}</h1>
        <p className="a-row text-secondary">{t.errorBody}</p>
        <button type="button" onClick={retry} className={buttonClass("primary", "mt-2")}>
          {t.retry}
        </button>
        <WhatsAppButton placement="app_error">{t.whatsapp}</WhatsAppButton>
      </main>
    </>
  );
}
