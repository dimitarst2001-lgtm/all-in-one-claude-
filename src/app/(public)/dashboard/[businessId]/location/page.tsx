import type { Metadata } from "next";

import { CoverageCitiesForm } from "@/features/dashboard/components/coverage-cities-form";
import { LocationForm } from "@/features/dashboard/components/location-form";
import { loadDashboardBusiness } from "@/features/dashboard/load";
import { getCoverageCities } from "@/features/dashboard/queries";
import { getCities } from "@/features/marketplace/queries";

export const metadata: Metadata = { title: "Адрес", robots: { index: false } };
// Private, per-user view: rendered on demand inside the layout's Suspense
// boundary rather than as an instant-navigation shell.
export const instant = false;

export default async function BusinessLocationPage({
  params,
}: PageProps<"/dashboard/[businessId]/location">) {
  const { businessId } = await params;
  const { business, canEdit } = await loadDashboardBusiness(
    businessId,
    `/dashboard/${businessId}/location`,
  );
  const location = business.location;
  const isRoadside = business.category.kind === "roadside";
  const [cities, coverage] =
    isRoadside && location
      ? await Promise.all([getCities(), getCoverageCities(location.id)])
      : [[], []];

  return (
    <section className="grid max-w-3xl gap-8">
      <div>
        <h2 className="mb-4 text-xl font-semibold">Адрес и местоположение</h2>
        {location ? (
          <LocationForm
            business={business}
            location={location}
            canEdit={canEdit}
          />
        ) : (
          <p className="text-muted-foreground">Няма въведен адрес.</p>
        )}
      </div>
      {isRoadside && location && (
        <CoverageCitiesForm
          businessId={business.id}
          locationId={location.id}
          cities={cities.map(({ slug, name }) => ({ slug, name }))}
          selected={coverage}
          canEdit={canEdit}
        />
      )}
    </section>
  );
}
