import Link from "next/link";
import { MapPinIcon, NavigationIcon, PhoneIcon, StarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { businessPath, formatDistance, telHref } from "../format";
import type { BusinessCard as BusinessCardData } from "../types";
import { BusinessLogo } from "./business-logo";
import { TrackedLink } from "./tracked-link";
import {
  BookingBadge,
  DemoBadge,
  OpenStatusBadge,
  VerifiedBadge,
} from "./status-badges";

type BusinessCardProps = {
  business: BusinessCardData;
  /** Distance is only meaningful relative to the user's own position. */
  showDistance: boolean;
  className?: string;
};

export function BusinessCard({
  business,
  showDistance,
  className,
}: BusinessCardProps) {
  const href = businessPath(business.city_slug, business.slug);

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-card transition-shadow hover:shadow-raised sm:p-5",
        business.is_featured && "border-primary/40",
        className,
      )}
      aria-labelledby={`business-${business.id}`}
    >
      <div className="flex gap-4">
        <BusinessLogo name={business.name} path={business.logo_path} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">
            {business.category_name}
          </p>
          <h3
            id={`business-${business.id}`}
            className="mt-0.5 truncate text-base font-semibold sm:text-lg"
          >
            <Link
              href={href}
              className="hover:underline focus-visible:underline"
            >
              {business.name}
            </Link>
          </h3>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPinIcon
              className="mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
            <span className="min-w-0">
              {business.address}
              {showDistance && business.distance_km !== null && (
                <span className="ml-1.5 inline-flex items-center gap-1 font-medium text-foreground">
                  <NavigationIcon className="size-3" aria-hidden="true" />
                  {formatDistance(business.distance_km)}
                </span>
              )}
            </span>
          </p>
        </div>
      </div>

      {business.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {business.description}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {business.is_demo && <DemoBadge />}
        {business.is_verified && <VerifiedBadge />}
        <OpenStatusBadge openNow={business.open_now} is247={business.is_24_7} />
        {business.booking_enabled && <BookingBadge />}
        {business.rating_avg !== null && business.rating_count > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium">
            <StarIcon
              className="size-3.5 fill-warning text-warning"
              aria-hidden="true"
            />
            {business.rating_avg.toLocaleString("bg-BG")} (
            {business.rating_count})
          </span>
        )}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 [&>*]:min-w-[8.5rem]">
        {business.phone && (
          <Button asChild variant="outline" className="flex-1">
            <TrackedLink
              href={telHref(business.phone)}
              businessId={business.id}
              event="phone_click"
            >
              <PhoneIcon aria-hidden="true" />
              Обади се
            </TrackedLink>
          </Button>
        )}
        <Button asChild className="flex-1">
          <Link href={href}>Виж профила</Link>
        </Button>
      </div>
    </article>
  );
}
