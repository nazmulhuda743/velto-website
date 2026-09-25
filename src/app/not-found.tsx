import { NotFoundBeacon } from "@/components/consent/NotFoundBeacon";
import { ButtonLink } from "@/components/ui/Button";
import SiteLayout from "./(site)/layout";

export default function NotFound() {
  return (
    <SiteLayout>
      <NotFoundBeacon />
      <section className="container-page py-20 md:py-28">
        <div className="max-w-2xl">
          <p className="t-label uppercase text-blue">404</p>
          <h1 className="mt-3 t-h1 text-navy">We can’t find that page.</h1>
          <p className="mt-4 max-w-[52ch] t-body-lg text-body">
            The link may be old, or the page may have moved. You can still book a
            pickup, look through Velto’s services or go back to the homepage.
          </p>
          <div className="mt-8 flex flex-col gap-3 md:flex-row md:flex-wrap">
            <ButtonLink href="/book?source=404" event="book_pickup_click" placement="not_found">
              Book a Pickup
            </ButtonLink>
            <ButtonLink href="/services" variant="secondary">
              See Services
            </ButtonLink>
            <ButtonLink href="/" variant="secondary">
              Back to the homepage
            </ButtonLink>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
