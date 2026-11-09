import type { Metadata } from "next";

import { ProfileForm } from "@/features/dashboard/components/profile-form";
import { loadDashboardBusiness } from "@/features/dashboard/load";

export const metadata: Metadata = { title: "Профил", robots: { index: false } };

export default async function BusinessProfileSettingsPage({
  params,
}: PageProps<"/dashboard/[businessId]/profile">) {
  const { businessId } = await params;
  const { business, canEdit } = await loadDashboardBusiness(
    businessId,
    `/dashboard/${businessId}/profile`,
  );
  return (
    <section className="max-w-3xl">
      <h2 className="mb-4 text-xl font-semibold">Профил</h2>
      <ProfileForm business={business} canEdit={canEdit} />
    </section>
  );
}
