import Link from "next/link";
import { NavigationIcon, PhoneIcon, ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BusinessLogo } from "@/features/marketplace/components/business-logo";
import {
  DemoBadge,
  OpenStatusBadge,
  VerifiedBadge,
} from "@/features/marketplace/components/status-badges";
import { TrackedLink } from "@/features/marketplace/components/tracked-link";
import {
  businessPath,
  formatDistance,
  telHref,
} from "@/features/marketplace/format";

import { coverageLabel } from "../format";
import type { RoadsideProvider } from "../types";

export function RoadsideProviderCard({
  provider,
  showDistance,
}: {
  provider: RoadsideProvider;
  showDistance: boolean;
}) {
  const href = businessPath(provider.city_slug, provider.slug);
  return (
    <article
      aria-labelledby={`roadside-${provider.id}`}
      className="grid gap-4 rounded-lg border bg-card p-4 shadow-card sm:grid-cols-[1fr_auto] sm:items-center sm:p-5"
    >
      <div className="flex min-w-0 gap-4">
        <BusinessLogo name={provider.name} path={provider.logo_path} />
        <div className="grid min-w-0 gap-1.5">
          <h3
            id={`roadside-${provider.id}`}
            className="truncate text-base font-semibold sm:text-lg"
          >
            <Link href={href} className="hover:underline">
              {provider.name}
            </Link>
          </h3>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
              {coverageLabel(provider)}
            </span>
            {showDistance && (
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <NavigationIcon className="size-3" aria-hidden="true" />
                {formatDistance(provider.distance_km)} до базата
              </span>
            )}
          </p>
          {provider.services.length > 0 && (
            <p className="text-sm">{provider.services.join(" · ")}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {provider.is_demo && <DemoBadge />}
            {provider.is_verified && <VerifiedBadge />}
            <OpenStatusBadge
              openNow={provider.open_now}
              is247={provider.is_24_7}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:flex-col">
        {provider.phone && !provider.is_demo && (
          <Button asChild size="lg" className="flex-1">
            <TrackedLink
              href={telHref(provider.phone)}
              businessId={provider.id}
              event="phone_click"
            >
              <PhoneIcon aria-hidden="true" />
              Обади се
            </TrackedLink>
          </Button>
        )}
        {provider.is_demo && (
          <p className="max-w-48 text-xs text-muted-foreground">
            Примерна обява без реален телефон.
          </p>
        )}
        <Button asChild variant="outline" className="flex-1">
          <Link href={href}>Профил</Link>
        </Button>
      </div>
    </article>
  );
}
