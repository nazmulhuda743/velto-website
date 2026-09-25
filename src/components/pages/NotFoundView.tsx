import { NotFoundBeacon } from "@/components/consent/NotFoundBeacon";
import { ButtonLink } from "@/components/ui/Button";
import { dictionary } from "@/content/i18n";
import { getLocale } from "@/lib/i18n/server";

/** The public 404 content, in the page's language. */
export async function NotFoundView() {
  const t = dictionary(await getLocale()).notFound;
  return (
    <>
      <NotFoundBeacon />
      <section className="container-page py-20 md:py-28">
        <div className="max-w-2xl">
          <p className="t-label uppercase text-blue">404</p>
          <h1 className="mt-3 t-h1 text-navy">{t.title}</h1>
          <p className="mt-4 max-w-[52ch] t-body-lg text-body">{t.body}</p>
          <div className="mt-8 flex flex-col gap-3 md:flex-row md:flex-wrap">
            <ButtonLink href="/book?source=404" event="book_pickup_click" placement="not_found">
              {t.book}
            </ButtonLink>
            <ButtonLink href="/services" variant="secondary">
              {t.services}
            </ButtonLink>
            <ButtonLink href="/" variant="secondary">
              {t.home}
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
