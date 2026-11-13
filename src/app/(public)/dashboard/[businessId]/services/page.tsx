import type { Metadata } from "next";

import { ServicesManager } from "@/features/dashboard/components/services-manager";
import { loadDashboardBusiness } from "@/features/dashboard/load";

export const metadata: Metadata = { title: "Услуги", robots: { index: false } };
// Private, per-user view: rendered on demand inside the layout's Suspense
// boundary rather than as an instant-navigation shell.
export const instant = false;

export default async function BusinessServicesPage({
  params,
}: PageProps<"/dashboard/[businessId]/services">) {
  const { businessId } = await params;
  const { business, canEdit } = await loadDashboardBusiness(
    businessId,
    `/dashboard/${businessId}/services`,
  );
  return (
    <section className="max-w-3xl">
      <h2 className="mb-1 text-xl font-semibold">Услуги и цени</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Показват се в профила ти. Цените са ориентировъчни и в евро.
      </p>
      <ServicesManager business={business} canEdit={canEdit} />
    </section>
  );
}
