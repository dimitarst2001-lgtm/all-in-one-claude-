import { CategoryGrid } from "@/features/marketing/category-grid";
import { BusinessCta } from "@/features/marketing/business-cta";
import { FeaturedBusinesses } from "@/features/marketing/featured-businesses";
import { HomeHero } from "@/features/marketing/home-hero";
import { HowItWorks } from "@/features/marketing/how-it-works";
import { SpotlightSections } from "@/features/marketing/spotlight-sections";

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <CategoryGrid />
      <FeaturedBusinesses />
      <SpotlightSections />
      <HowItWorks />
      <BusinessCta />
    </>
  );
}
