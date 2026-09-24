import Link from "next/link";

export default function NotFound() {
  return (
    <section className="container-page py-20 md:py-28">
      <div className="max-w-2xl">
        <p className="t-label uppercase text-blue">404</p>
        <h1 className="mt-3 t-h1 text-navy">We can’t find that page.</h1>
        <p className="mt-4 max-w-[52ch] t-body-lg text-body">
          The link may be old, or the page may have moved. You can return home, view Velto’s services, or book a pickup.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-md bg-blue px-6 font-semibold text-white hover:bg-navy">
            Back to homepage
          </Link>
          <Link href="/services" className="inline-flex min-h-12 items-center justify-center rounded-md border border-line-strong bg-white px-6 font-semibold text-navy hover:border-navy">
            View services
          </Link>
          <Link href="/book?source=404" className="inline-flex min-h-12 items-center justify-center rounded-md border border-line-strong bg-white px-6 font-semibold text-navy hover:border-navy">
            Book a pickup
          </Link>
        </div>
      </div>
    </section>
  );
}
