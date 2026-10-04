import { AccountHomeView } from "@/components/account/views/AccountHomeView";
import { formText } from "@/content/i18n/forms";
import { getLocale } from "@/lib/i18n/server";
import Link from "next/link";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The app's Home: the account home, plus prices next to booking. */
export default async function AppHome({ searchParams }: { searchParams: SearchParams }) {
  const t = formText(await getLocale()).common.appBar;
  return (
    <>
      <AccountHomeView params={await searchParams} base="/app" />
      <p className="mt-6 text-center">
        <Link href="/app/prices" className="inline-flex min-h-11 items-center px-3 font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue" data-app-prices-link>
          {t.seePrices}
        </Link>
      </p>
    </>
  );
}
