import { DetailsForm } from "@/components/app/profile/DetailsForm";
import { profileSession, SubScreen } from "@/components/app/profile/SubScreen";
import { accountText } from "@/content/i18n/account";
import { formText } from "@/content/i18n/forms";
import { fill } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";

export default async function AppProfileDetails() {
  const { account: a } = await profileSession("/app/profile/details");
  if (a.state !== "ready") return null;
  const locale = await getLocale();
  const t = accountText(locale).forms;
  const app = formText(locale).common.app;
  const locked = a.phoneVerified ? t.lockedVerified : a.link.status === "linked" ? t.lockedLinked : a.link.status === "pending" ? t.lockedPending : null;
  const areas = [...Array.from({ length: 18 }, (_, i) => ({ value: String(i + 1), label: fill(t.areaSector, { n: i + 1 }, locale) })), { value: "outside", label: t.areaOutside }];
  return (
    <SubScreen title={app.pDetails} foot={app.prefFoot}>
      <DetailsForm
        initial={{ fullName: a.fullName, phone: a.phone, address: a.address ?? "", area: a.area ?? "" }}
        areas={areas}
        t={{ fullNameLabel: t.fullNameLabel, phoneLabel: t.phoneLabel, addressLabel: t.addressLabel, areaLabel: t.areaLabel, areaNotSet: t.areaNotSet, locked, saveFailed: accountText(locale).actions.saveFailed }}
      />
    </SubScreen>
  );
}
