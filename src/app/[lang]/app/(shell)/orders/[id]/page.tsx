import { AppScreen } from "@/components/app/AppScreen";
import { AppOrderView } from "@/components/app/orders/AppOrderView";
import { AppHeader } from "@/components/pwa/AppHeader";
import { formText } from "@/content/i18n/forms";
import { getLocale } from "@/lib/i18n/server";

type Params = Promise<{ id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

/** Order detail: "← Orders" and the order number on top instead of the logo. */
export default async function AppOrder({ params, searchParams }: { params: Params; searchParams: Search }) {
  const id = (await params).id;
  const t = formText(await getLocale()).common.appBar;
  let shown = id;
  try {
    shown = decodeURIComponent(id);
  } catch {}
  return (
    <AppScreen header={<AppHeader back={{ href: "/app/orders", label: t.orders }} aside={/^VELR?-\d{5}$/.test(shown) ? shown : undefined} />}>
      <AppOrderView id={id} care={(await searchParams).care} />
    </AppScreen>
  );
}
