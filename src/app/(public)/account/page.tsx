import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountOverview } from "@/features/auth/components/account-overview";

export const metadata: Metadata = {
  title: "Моят профил",
  robots: { index: false },
};

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <>
      <PageHeader title="Моят профил" />
      <div className="container-page py-10">
        <Suspense fallback={<Skeleton className="h-48 max-w-2xl" />}>
          <AccountOverview searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}
