import { AddressesForm } from "@/components/app/profile/PrefsForms";
import { profileSession, SubScreen } from "@/components/app/profile/SubScreen";
import { accountText } from "@/content/i18n/account";
import { formText } from "@/content/i18n/forms";
import { getPreferences } from "@/lib/customer/portal";
import { fill } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";

export default async function AppProfileAddresses() {
  await profileSession("/app/profile/addresses");
  const locale = await getLocale();
  const t = accountText(locale).forms;
  const app = formText(locale).common.app;
  const prefs = await getPreferences();
  const areas = [...Array.from({ length: 18 }, (_, i) => ({ value: String(i + 1), label: fill(t.areaSector, { n: i + 1 }, locale) })), { value: "outside", label: t.areaOutside }];
  return (
    <SubScreen title={app.pAddresses} foot={app.prefFoot}>
      <AddressesForm
        care={prefs.care}
        addresses={prefs.addresses}
        areas={areas}
        t={{ addAddress: app.addAddress, addressName: app.addressName, addressLabel: t.addressLabel, areaLabel: t.areaLabel, areaNotSet: t.areaNotSet, removeAddress: app.removeAddress, failed: accountText(locale).actions.saveFailed }}
      />
    </SubScreen>
  );
}
