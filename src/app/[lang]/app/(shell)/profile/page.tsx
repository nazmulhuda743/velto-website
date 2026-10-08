import { AppScreen } from "@/components/app/AppScreen";
import { AppProfileView } from "@/components/app/profile/AppProfileView";

/** Profile in the app: a list of settings, each on its own screen (design "Profile"). */
export default function AppProfile() {
  return (
    <AppScreen>
      <AppProfileView />
    </AppScreen>
  );
}
