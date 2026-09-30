import { pageMetadata } from "@/lib/seo/page-metadata";
import { MobileConversionBar } from "@/components/layout/MobileConversionBar";
import { FAQ, faqItems } from "@/components/home/FAQ";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { FindAPrice } from "@/components/home/FindAPrice";
import { Hero } from "@/components/home/Hero";
import { HouseholdSection } from "@/components/home/HouseholdSection";
import { LocationsSection } from "@/components/home/LocationsSection";
import { ProcessStory } from "@/components/home/ProcessStory";
import { RegularLaundrySection } from "@/components/home/RegularLaundrySection";
import { ReviewsSection } from "@/components/home/ReviewsSection";
import { ServiceChooser } from "@/components/home/ServiceChooser";
import { IMAGES } from "@/content/mock";
import { getLocale } from "@/lib/i18n/server";

const FINAL_ID = "book";

export const generateMetadata = () => pageMetadata("/");

/**
 * Homepage — section order is LOCKED (spec §19). The owner-requested proof strip was retired when hero proof
 * became figures (H9). Owner-approved tightening: same sections and order, repetition removed within them.
 */
export default async function HomePage() {
  const locale = await getLocale();
  return (
    <>
      <Hero />
      <ServiceChooser />
      <ProcessStory />
      <ReviewsSection />
      <LocationsSection />
      <FindAPrice />
      <HouseholdSection />
      <RegularLaundrySection />
      {/* Turnaround and free delivery are already stated in the hero figures and Find a Price. */}
      <FAQ eyebrow={null} items={faqItems(locale, "area", "stains", "unsure", "express", "household")} />
      <FinalBookingCTA id={FINAL_ID} image={IMAGES.final} />
      <MobileConversionBar finalSectionId={FINAL_ID} />
    </>
  );
}
