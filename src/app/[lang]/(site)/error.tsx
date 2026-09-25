"use client";

import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { WHATSAPP_URL } from "@/content/site";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="container-page py-20 md:py-28">
      <div className="max-w-2xl">
        <p className="t-label uppercase text-error">Something went wrong</p>
        <h1 className="mt-3 t-h1 text-navy">This page didn&apos;t load properly.</h1>
        <p className="mt-4 max-w-[52ch] t-body-lg text-body">
          Please try again. If you were sending a booking or quote and didn&apos;t see a confirmation,
          send it again or message Velto on WhatsApp and we&apos;ll check.
        </p>
        <div className="mt-8 flex flex-col gap-3 md:flex-row md:flex-wrap">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-[52px] items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover lg:h-12"
          >
            Try Again
          </button>
          <WhatsAppButton href={WHATSAPP_URL} placement="error_page" />
          <ButtonLink href="/" variant="secondary">
            Back to the homepage
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
