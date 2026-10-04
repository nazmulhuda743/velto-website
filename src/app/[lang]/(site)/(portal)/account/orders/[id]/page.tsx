import { OrderDetailView } from "@/components/account/views/OrderDetailView";

type Params = Promise<{ id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * One order. The order number in the URL is only a lookup key: the database returns the
 * order only if it belongs to the signed-in customer's verified Velto record.
 */
export default async function OrderPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  return <OrderDetailView id={(await params).id} care={(await searchParams).care} />;
}
