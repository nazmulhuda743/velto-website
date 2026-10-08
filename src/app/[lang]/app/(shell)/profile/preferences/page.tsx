import { ShirtsForm } from "@/components/app/profile/PrefsForms";
import { profileSession, SubScreen } from "@/components/app/profile/SubScreen";
import { accountText } from "@/content/i18n/account";
import { formText } from "@/content/i18n/forms";
import { getPreferences } from "@/lib/customer/portal";
import { getLocale } from "@/lib/i18n/server";

export default async function AppProfilePreferences() {
  await profileSession("/app/profile/preferences");
  const locale = await getLocale();
  const app = formText(locale).common.app;
  const prefs = await getPreferences();
  return (
    <SubScreen title={app.prefTitle} sub={app.prefSub} foot={`${app.prefFoot} ${app.prefDefault}`}>
      <ShirtsForm care={prefs.care} addresses={prefs.addresses} t={{ prefShirts: app.prefShirts, noPref: app.noPref, hanger: app.hanger, folded: app.folded, failed: accountText(locale).actions.saveFailed }} />
    </SubScreen>
  );
}
