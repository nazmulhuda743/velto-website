import { NotificationsForm } from "@/components/app/profile/NotificationsForm";
import { profileSession, SubScreen } from "@/components/app/profile/SubScreen";
import { formText } from "@/content/i18n/forms";
import { getLocale } from "@/lib/i18n/server";
import { DEFAULT_PUSH_PREFS, pushPrefsFromStatus, type PushPrefs } from "@/lib/push/prefs";
import { supabaseRpc } from "@/lib/supabase-server";

export default async function AppProfileNotifications() {
  const session = await profileSession("/app/profile/notifications");
  const locale = await getLocale();
  const app = formText(locale).common.app;
  const push = await supabaseRpc<{ devices: number } & Partial<PushPrefs>>("website_push_status", { p_auth_user_id: session.user.id }).catch(() => null);
  return (
    <SubScreen title={app.pNotif} sub={app.notifScreenSub} foot={app.prefFoot}>
      <NotificationsForm initial={pushPrefsFromStatus(push) ?? DEFAULT_PUSH_PREFS} lang={locale === "bn" ? "bn" : "en"} t={{ rows: app.notifRows, phoneOff: app.notifPhoneOff, turnOn: app.turnOn }} />
    </SubScreen>
  );
}
