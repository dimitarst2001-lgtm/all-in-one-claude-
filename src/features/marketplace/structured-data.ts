import { siteConfig } from "@/config/site";

import { businessPath, publicMediaUrl } from "./format";
import type { BusinessProfile } from "./types";

const SCHEMA_TYPES: Record<string, string> = {
  "auto-repair": "AutoRepair",
  "car-wash": "AutoWash",
  "tire-services": "TireShop",
  "car-detailing": "AutomotiveBusiness",
  "roadside-assistance": "AutomotiveBusiness",
};

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * schema.org LocalBusiness data for a profile. Ratings are only included
 * when real, published reviews exist. Demo listings get no structured data.
 */
export function businessJsonLd(
  profile: BusinessProfile,
): Record<string, unknown> | null {
  if (profile.is_demo) return null;
  const location = profile.locations[0];
  const logo = profile.media.find((item) => item.kind === "logo");

  return {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPES[profile.category.slug] ?? "AutomotiveBusiness",
    "@id": new URL(
      businessPath(profile.city.slug, profile.slug),
      siteConfig.url,
    ).toString(),
    name: profile.name,
    description: profile.description ?? undefined,
    url: new URL(
      businessPath(profile.city.slug, profile.slug),
      siteConfig.url,
    ).toString(),
    telephone: profile.phone ?? undefined,
    email: profile.email ?? undefined,
    sameAs: profile.website ? [profile.website] : undefined,
    image: logo ? (publicMediaUrl(logo.path) ?? undefined) : undefined,
    address: location
      ? {
          "@type": "PostalAddress",
          streetAddress: location.address,
          postalCode: location.postal_code ?? undefined,
          addressLocality: location.city_name,
          addressCountry: "BG",
        }
      : undefined,
    geo: location
      ? {
          "@type": "GeoCoordinates",
          latitude: location.lat,
          longitude: location.lng,
        }
      : undefined,
    openingHoursSpecification:
      location && location.hours_verified
        ? location.is_24_7
          ? [
              {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: DAY_NAMES,
                opens: "00:00",
                closes: "23:59",
              },
            ]
          : location.hours.map((hour) => ({
              "@type": "OpeningHoursSpecification",
              dayOfWeek: DAY_NAMES[hour.weekday - 1],
              opens: hour.opens_at,
              closes: hour.closes_at,
            }))
        : undefined,
    aggregateRating: profile.rating
      ? {
          "@type": "AggregateRating",
          ratingValue: profile.rating.avg,
          reviewCount: profile.rating.count,
        }
      : undefined,
  };
}
