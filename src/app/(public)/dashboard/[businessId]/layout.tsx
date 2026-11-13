import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { DashboardNav } from "@/features/dashboard/components/dashboard-nav";
import { StatusBadge } from "@/features/dashboard/components/status-badge";
import { loadDashboardBusiness } from "@/features/dashboard/load";
import { businessPath } from "@/features/marketplace/format";

async function DashboardHeader({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const { business } = await loadDashboardBusiness(
    businessId,
    `/dashboard/${businessId}`,
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Моите бизнеси
          </Link>
          <h1 className="mt-1 text-2xl font-semibold md:text-3xl">
            {business.name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge status={business.status} />
            {business.category.name} · {business.city.name}
          </p>
        </div>
        {business.is_public && (
          <Link
            href={businessPath(business.city.slug, business.slug)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Виж публичния профил
            <ExternalLinkIcon className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      <DashboardNav businessId={business.id} />
    </div>
  );
}

export default function BusinessDashboardLayout({
  children,
  params,
}: LayoutProps<"/dashboard/[businessId]">) {
  return (
    <div className="container-page grid gap-8 py-8 md:py-10">
      <Suspense fallback={<Skeleton className="h-28" />}>
        <DashboardHeader params={params} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-96" />}>{children}</Suspense>
    </div>
  );
}
