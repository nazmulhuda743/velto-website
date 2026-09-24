"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="container-page py-20 md:py-28">
      <div className="max-w-2xl">
        <p className="t-label uppercase text-error">Something went wrong</p>
        <h1 className="mt-3 t-h1 text-navy">This page couldn’t load properly.</h1>
        <p className="mt-4 max-w-[52ch] t-body-lg text-body">
          Your booking or quote is not treated as successful unless Velto shows a real confirmation. Try this page again, or use another route below.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-blue px-6 font-semibold text-white hover:bg-navy"
          >
            Try again
          </button>
          <Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-md border border-line-strong bg-white px-6 font-semibold text-navy hover:border-navy">
            Back to homepage
          </Link>
          <Link href="/book?source=error" className="inline-flex min-h-12 items-center justify-center rounded-md border border-line-strong bg-white px-6 font-semibold text-navy hover:border-navy">
            Book a pickup
          </Link>
        </div>
      </div>
    </section>
  );
}
