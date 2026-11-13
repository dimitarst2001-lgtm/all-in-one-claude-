import type { Metadata } from "next";
import Link from "next/link";

import { HoursForm } from "@/features/dashboard/components/hours-form";
import { loadDashboardBusiness } from "@/features/dashboard/load";

export const metadata: Metadata = {
  title: "Работно време",
  robots: { index: false },
};
// Private, per-user view: rendered on demand inside the layout's Suspense
// boundary rather than as an instant-navigation shell.
export const instant = false;

export default async function BusinessHoursPage({
  params,
}: PageProps<"/dashboard/[businessId]/hours">) {
  const { businessId } = await params;
  const { business, canEdit } = await loadDashboardBusiness(
    businessId,
    `/dashboard/${businessId}/hours`,
  );
  const location = business.location;
  return (
    <section className="max-w-3xl">
      <h2 className="mb-4 text-xl font-semibold">Работно време</h2>
      {!location ? (
        <p className="text-muted-foreground">
          Първо{" "}
          <Link
            href={`/dashboard/${business.id}/location`}
            className="text-primary underline"
          >
            въведи адрес
          </Link>
          .
        </p>
      ) : (
        <>
          {location.is_24_7 && (
            <p className="mb-4 rounded-md border bg-accent/60 p-3 text-sm">
              Обектът е отбелязан като работещ 24/7. Часовете по-долу се
              показват като допълнителна информация.
            </p>
          )}
          <HoursForm
            businessId={business.id}
            locationId={location.id}
            hours={location.hours}
            canEdit={canEdit}
          />
        </>
      )}
    </section>
  );
}
