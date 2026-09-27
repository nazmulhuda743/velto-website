import type { Metadata } from "next";
import { dictionary } from "@/content/i18n";
import { getLocale } from "@/lib/i18n/server";
import { getSiteContent } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Offline | Velto Premium Laundry",
  robots: { index: false, follow: false },
};

/**
 * Shown by the service worker when there is no connection and no saved copy of the page. Stored
 * on the device when the worker installs, so it must work with no network at all: the WhatsApp
 * link goes straight to wa.me (the usual /go/whatsapp redirect needs the server).
 */
export default async function OfflinePage() {
  const locale = await getLocale();
  const t = dictionary(locale).offline;
  const common = dictionary(locale).common;
  const { settings } = await getSiteContent();
  return (
    <section className="container-page py-20 md:py-28">
      <div className="max-w-2xl">
        <h1 className="t-h1 text-navy">{t.title}</h1>
        <p className="mt-4 max-w-[52ch] t-body-lg text-body">{t.body}</p>
        <div className="mt-8 flex flex-col gap-3 md:flex-row">
          {/* An empty href reloads the address the visitor asked for. */}
          <a href="" className="inline-flex h-[52px] items-center justify-center rounded-md bg-action px-6 text-base font-semibold text-white hover:bg-action-hover lg:h-12">
            {t.retry}
          </a>
          <a
            href={`https://wa.me/${settings.whatsappNumber}`}
            rel="noopener noreferrer"
            className="inline-flex h-[52px] items-center justify-center rounded-md border border-line-strong bg-white px-6 text-base font-semibold text-navy hover:border-navy lg:h-12"
          >
            {common.whatsappVelto}
          </a>
        </div>
        <p className="mt-4 max-w-[52ch] t-small text-secondary">{t.whatsappNote}</p>
      </div>
    </section>
  );
}
