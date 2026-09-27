import { dictionary } from "@/content/i18n";
import { keepBanglaSuffixes } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { dhakaDay, popupActive, popupProblem } from "@/lib/promo";
import { getSiteContent } from "@/lib/site-content";
import { PromoPopup } from "./PromoPopup";

/**
 * Mounts the campaign popup with the page-language text. Nothing is rendered when the popup is
 * incomplete; a complete but switched-off popup is still mounted so ?promo=preview can show it.
 */
export async function CampaignPopup() {
  const { promo } = await getSiteContent();
  if (popupProblem(promo)) return null;
  const locale = await getLocale();
  const t = dictionary(locale).promo;
  const bn = locale === "bn";
  const pick = (en: string, bangla: string) => (bn && bangla.trim() ? keepBanglaSuffixes(bangla) : en);
  return (
    <PromoPopup
      popup={{
        version: promo.version,
        image: promo.image,
        imageAlt: pick(promo.imageAlt, promo.imageAltBn),
        tag: pick(promo.tag, promo.tagBn),
        title: pick(promo.title, promo.titleBn),
        body: pick(promo.body, promo.bodyBn),
        cta: pick(promo.cta, promo.ctaBn),
        href: promo.href,
        frequency: promo.frequency,
        delaySeconds: promo.delaySeconds,
        active: popupActive(promo),
        startsAt: promo.startsOn ? dhakaDay(promo.startsOn, "start") : null,
        endsAt: promo.endsOn ? dhakaDay(promo.endsOn, "end") : null,
      }}
      labels={{ dialogLabel: t.dialogLabel, close: t.close, notNow: t.notNow, posterOpens: t.posterOpens }}
    />
  );
}
