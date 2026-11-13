import type { Metadata } from "next";

import { LocationForm } from "@/features/dashboard/components/location-form";
import { loadDashboardBusiness } from "@/features/dashboard/load";

export const metadata: Metadata = { title: "Адрес", robots: { index: false } };

export default async function BusinessLocationPage({
  params,
}: PageProps<"/dashboard/[businessId]/location">) {
  const { businessId } = await params;
  const { business, canEdit } = await loadDashboardBusiness(
    businessId,
    `/dashboard/${businessId}/location`,
  );
  return (
    <section className="max-w-3xl">
      <h2 className="mb-4 text-xl font-semibold">Адрес и местоположение</h2>
      {business.location ? (
        <LocationForm
          business={business}
          location={business.location}
          canEdit={canEdit}
        />
      ) : (
        <p className="text-muted-foreground">Няма въведен адрес.</p>
      )}
    </section>
  );
}
