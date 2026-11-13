import Link from "next/link";

import { siteConfig } from "@/config/site";
import { BusinessCard } from "@/features/marketplace/components/business-card";
import { searchBusinesses } from "@/features/marketplace/queries";

import { Section } from "./section";

/** Featured = Premium priority placement first, then verified, then the rest (see search_businesses). */
export async function FeaturedBusinesses() {
  const result = await searchBusinesses({ city: "varna" }, 6);
  if (result.items.length === 0) return null;

  return (
    <Section
      id="featured"
      eyebrow="Препоръчани"
      title={`Бизнеси във ${siteConfig.launchCity}`}
      description="Профили с услуги, цени и работно време. Демо обявите са отбелязани ясно."
      className="pt-0"
    >
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {result.items.map((business) => (
          <li key={business.id} className="flex">
            <BusinessCard
              business={business}
              showDistance={false}
              className="w-full"
            />
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <Link
          href="/varna"
          className="text-sm font-medium text-primary hover:underline"
        >
          Всички автоуслуги във {siteConfig.launchCity}
        </Link>
      </div>
    </Section>
  );
}
