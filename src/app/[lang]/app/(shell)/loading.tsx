import { AppScreen } from "@/components/app/AppScreen";
import { accountText } from "@/content/i18n/account";
import { getLocale } from "@/lib/i18n/server";

/** Shown at once when a tab is tapped, inside the app shell, while the screen loads on the server. */
export default async function AppLoading() {
  const t = accountText(await getLocale()).layout;
  return (
    <AppScreen>
      <div role="status">
        <span className="skeleton block h-8 w-56" />
        <span className="skeleton mt-3 block h-4 w-72 max-w-full" />
        <div className="mt-7 rounded-2xl border border-line bg-white p-5">
          <span className="skeleton block h-3.5 w-28" />
          <span className="skeleton mt-4 block h-7 w-40" />
          <span className="skeleton mt-5 block h-2 w-full" />
        </div>
        <span className="sr-only">{t.loading}</span>
      </div>
    </AppScreen>
  );
}
