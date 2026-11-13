import type { Metadata } from "next";

import { MediaManager } from "@/features/dashboard/components/media-manager";
import { loadDashboardBusiness } from "@/features/dashboard/load";
import { getBusinessMedia } from "@/features/dashboard/queries";

export const metadata: Metadata = { title: "Снимки", robots: { index: false } };
// Private, per-user view: rendered on demand inside the layout's Suspense
// boundary rather than as an instant-navigation shell.
export const instant = false;

export default async function BusinessPhotosPage({
  params,
}: PageProps<"/dashboard/[businessId]/photos">) {
  const { businessId } = await params;
  const { business, canEdit } = await loadDashboardBusiness(
    businessId,
    `/dashboard/${businessId}/photos`,
  );
  const media = await getBusinessMedia(business.id);

  return (
    <section className="max-w-4xl">
      <h2 className="mb-1 text-xl font-semibold">Снимки</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Добри снимки на обекта помагат на клиентите да ви изберат и да ви
        намерят на място.
      </p>
      <MediaManager
        businessId={business.id}
        businessName={business.name}
        media={media}
        maxImages={business.limits.max_images}
        canEdit={canEdit}
      />
    </section>
  );
}
