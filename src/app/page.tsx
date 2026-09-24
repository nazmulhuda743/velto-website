import type { Metadata } from "next";
import { MobileConversionBar } from "@/components/layout/MobileConversionBar";
import { FAQ } from "@/components/home/FAQ";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { FindAPrice } from "@/components/home/FindAPrice";
import { Hero } from "@/components/home/Hero";
import { HouseholdSection } from "@/components/home/HouseholdSection";
import { LocationsSection } from "@/components/home/LocationsSection";
import { ProcessStory } from "@/components/home/ProcessStory";
import { ProofMarquee } from "@/components/home/ProofMarquee";
import { RegularLaundrySection } from "@/components/home/RegularLaundrySection";
import { ReviewsSection } from "@/components/home/ReviewsSection";
import { ServiceChooser } from "@/components/home/ServiceChooser";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const FINAL_ID = "book";

/** Homepage — section order is LOCKED (spec §19); the proof strip under the hero was added at the owner's request. */
export default function HomePage() {
  return (
    <>
      <Hero />
      <ProofMarquee />
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
