import { AppScreen } from "@/components/app/AppScreen";
import { BookingSection } from "@/components/forms/BookingSection";
import { AppHeader, HeaderPill } from "@/components/pwa/AppHeader";
import { formText } from "@/content/i18n/forms";
import { getLocale } from "@/lib/i18n/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Book from the app: the same form as the website's /book, signed in, links staying in the app. */
export default async function AppBook({ searchParams }: { searchParams: SearchParams }) {
  const t = formText(await getLocale()).common.appBar;
  return (
    <AppScreen header={<AppHeader actions={<HeaderPill href="/app/prices">{t.prices}</HeaderPill>} />}>
      <BookingSection params={await searchParams} base="/app" />
    </AppScreen>
  );
}
