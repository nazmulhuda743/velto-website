import { redirect } from "next/navigation";
import { AccountHomeView } from "@/components/account/views/AccountHomeView";
import { localHref } from "@/lib/i18n/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AccountHome({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  // Old WhatsApp links (velto.com.bd/app used to land here with ?install=1): the install screen now lives at /app.
  if (params.install === "1") redirect(await localHref("/app"));
  return <AccountHomeView params={params} />;
}
