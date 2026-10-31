import { redirect } from "next/navigation";
import { LanguagePick } from "@/components/app/profile/LanguagePick";
import { profileSession, SubScreen } from "@/components/app/profile/SubScreen";
import { formText } from "@/content/i18n/forms";
import { banglaEnabled } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";

export default async function AppProfileLanguage() {
  await profileSession("/app/profile/language");
  if (!banglaEnabled()) redirect("/app/profile");
  const locale = await getLocale();
  const app = formText(locale).common.app;
  return (
    <SubScreen title={app.pLang}>
      <LanguagePick current={locale === "bn" ? "bn" : "en"} names={app.langNames} />
    </SubScreen>
  );
}
