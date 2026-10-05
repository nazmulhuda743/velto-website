import { AppScreen } from "@/components/app/AppScreen";
import { OrdersView } from "@/components/account/views/OrdersView";

export default function AppOrders() {
  return (
    <AppScreen>
      <OrdersView base="/app" />
    </AppScreen>
  );
}
