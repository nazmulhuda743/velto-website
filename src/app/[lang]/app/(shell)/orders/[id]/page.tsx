import { OrderDetailView } from "@/components/account/views/OrderDetailView";

type Params = Promise<{ id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function AppOrder({ params, searchParams }: { params: Params; searchParams: Search }) {
  return <OrderDetailView id={(await params).id} care={(await searchParams).care} base="/app" />;
}
