import { MobileConversionBar } from "@/components/layout/MobileConversionBar";
import { FAQ } from "@/components/home/FAQ";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { FindAPrice } from "@/components/home/FindAPrice";
import { Hero } from "@/components/home/Hero";
import { HouseholdSection } from "@/components/home/HouseholdSection";
import { LocationsSection } from "@/components/home/LocationsSection";
import { ProcessStory } from "@/components/home/ProcessStory";
import { RegularLaundrySection } from "@/components/home/RegularLaundrySection";
import { ReviewsSection } from "@/components/home/ReviewsSection";
import { ServiceChooser } from "@/components/home/ServiceChooser";

const FINAL_ID = "book";

/** Homepage — section order is LOCKED (spec §19). */
export default function HomePage() {
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
      <FAQ />
      <FinalBookingCTA id={FINAL_ID} />
      <MobileConversionBar finalSectionId={FINAL_ID} />
    </>
  );
}
