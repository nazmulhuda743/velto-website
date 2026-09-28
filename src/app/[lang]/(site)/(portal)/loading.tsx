import { accountText } from "@/content/i18n/account";
import { getLocale } from "@/lib/i18n/server";

/**
 * Shown the moment someone opens an /account page. The account layout checks the session
 * and loads orders on the server; without this boundary a tap looked like it did nothing
 * until that finished, so people tapped again.
 */
export default async function AccountLoading() {
  const t = accountText(await getLocale()).layout;
  return (
    <div role="status" className="bg-warm">
      <div className="border-b border-line bg-white xl:hidden">
        <div className="container-page grid h-12 grid-cols-3 items-center">
          {[0, 1, 2].map((i) => (
            <span key={i} className="skeleton mx-auto h-3.5 w-20" />
          ))}
        </div>
      </div>
      <div className="container-page grid gap-8 py-7 md:py-10 xl:grid-cols-12 xl:gap-8 xl:py-11">
        <div className="hidden space-y-3 xl:col-span-3 xl:block">
          {[0, 1, 2].map((i) => (
            <span key={i} className="skeleton block h-4 w-32" />
          ))}
        </div>
        <div className="min-w-0 xl:col-span-9 xl:col-start-4">
          <span className="skeleton block h-8 w-56" />
          <span className="skeleton mt-3 block h-4 w-72 max-w-full" />
          <div className="mt-7 rounded-lg border border-line bg-white p-5 md:p-7">
            <span className="skeleton block h-3.5 w-28" />
            <span className="skeleton mt-4 block h-9 w-48" />
            <span className="skeleton mt-6 block h-2 w-full" />
            <div className="mt-7 grid grid-cols-2 gap-6 border-t border-line pt-5 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <span key={i} className="skeleton block h-4 w-24" />
              ))}
            </div>
          </div>
          <p className="sr-only">{t.loading}</p>
        </div>
      </div>
    </div>
  );
}
