import { AppScreen } from "@/components/app/AppScreen";
import { accountText } from "@/content/i18n/account";
import { getLocale } from "@/lib/i18n/server";

const bar = (className: string) => <span className={`skeleton block rounded-md ${className}`} />;

/**
 * Shown at once when a tab is tapped, inside the app shell, while the screen loads on the server:
 * the design's Home skeleton (title, a state card, recent orders). Never a spinner or "–".
 */
export default async function AppLoading() {
  const t = accountText(await getLocale()).layout;
  return (
    <AppScreen>
      <div role="status" className="flex flex-col gap-3.5">
        {bar("h-[30px] w-[220px] max-w-full rounded-lg")}
        {bar("h-4 w-40")}
        <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-line bg-app-card p-5">
          {bar("h-3 w-[110px]")}
          {bar("h-6 w-[200px] max-w-full")}
          {bar("h-4 w-[260px] max-w-full")}
          {bar("h-4 w-[180px]")}
          {bar("mt-2 h-13 w-full rounded-xl")}
        </div>
        {bar("mt-3 h-[18px] w-[120px]")}
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-app-card p-4">
            {bar("h-4 w-[140px]")}
            {bar("h-3.5 w-[200px] max-w-full")}
          </div>
        ))}
        <span className="sr-only">{t.loading}</span>
      </div>
    </AppScreen>
  );
}
