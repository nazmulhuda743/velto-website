import { RoutineCard } from "@/components/account/RoutineCard";
import { profileSession, SubScreen } from "@/components/app/profile/SubScreen";
import { Banner } from "@/components/app/ui";
import { accountText, orderFormat } from "@/content/i18n/account";
import { formText } from "@/content/i18n/forms";
import { getPortalOrders } from "@/lib/customer/portal";
import { laundryRhythm } from "@/lib/customer/rhythm";
import { getRoutine } from "@/lib/customer/routine";
import { getLocale } from "@/lib/i18n/server";

/** Profile › Weekly pickup: the existing routine request, pause, resume and stop. */
export default async function AppProfileWeekly() {
  const { account: a } = await profileSession("/app/profile/weekly");
  if (a.state !== "ready") return null;
  const locale = await getLocale();
  const at = accountText(locale);
  const f = formText(locale);
  const [routine, orders] = await Promise.all([getRoutine(), a.link.status === "linked" ? getPortalOrders() : Promise.resolve([])]);
  const rhythm = laundryRhythm(orders ?? []);
  return (
    <SubScreen title={f.common.app.pWeekly}>
      {routine === "error" ? (
        <Banner tone="error">{at.routine.failed}</Banner>
      ) : (
        <RoutineCard
          base="/app"
          routine={routine}
          hasAddress={Boolean(a.address && a.area)}
          t={at.routine}
          days={f.bookPage.routineDays}
          windows={f.booking.slots}
          services={f.booking.services}
          nextOnLabel={routine?.nextOn ? orderFormat(locale).day(routine.nextOn) : null}
          suggestedDay={rhythm.usualWeekday}
          suggestedService={rhythm.repeatService}
        />
      )}
    </SubScreen>
  );
}
