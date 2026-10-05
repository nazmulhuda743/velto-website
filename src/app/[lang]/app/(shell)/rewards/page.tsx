import { AppScreen } from "@/components/app/AppScreen";
import { RewardsView } from "@/components/account/views/RewardsView";

export default function AppRewards() {
  return (
    <AppScreen>
      <RewardsView base="/app" />
    </AppScreen>
  );
}
