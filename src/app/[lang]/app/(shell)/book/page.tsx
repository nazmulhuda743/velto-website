import { AppScreen } from "@/components/app/AppScreen";
import { AppBookView } from "@/components/app/book/AppBookView";
import { AppHeader, HeaderPill } from "@/components/pwa/AppHeader";
import { formText } from "@/content/i18n/forms";
import { getLocale } from "@/lib/i18n/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Book from the app: the last order as a summary, each row opening a sheet (design "Book"). */
export default async function AppBook({ searchParams }: { searchParams: SearchParams }) {
  const t = formText(await getLocale()).common.appBar;
  return (
    <AppScreen header={<AppHeader actions={<HeaderPill href="/app/prices">{t.prices}</HeaderPill>} />}>
      <AppBookView params={await searchParams} />
    </AppScreen>
  );
}
