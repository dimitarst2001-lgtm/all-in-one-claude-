import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, PlusIcon, StoreIcon } from "lucide-react";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/features/auth/session";
import { StatusBadge } from "@/features/dashboard/components/status-badge";
import { getMyBusinesses } from "@/features/dashboard/queries";
import { roleLabels } from "@/features/dashboard/types";

export const metadata: Metadata = {
  title: "Табло за бизнеси",
  robots: { index: false },
};

async function BusinessList() {
  await requireUser("/dashboard");
  const businesses = await getMyBusinesses();

  if (businesses.length === 0) {
    return (
      <div className="max-w-xl rounded-lg border bg-card p-6 shadow-card md:p-8">
        <span className="mb-4 flex size-11 items-center justify-center rounded-md bg-accent text-primary">
          <StoreIcon className="size-5" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-semibold">
          Създай първия си бизнес профил
        </h2>
        <p className="mt-2 text-muted-foreground">
          Отнема няколко минути: име, категория, адрес и телефон. След това
          добавяш работно време и услуги и изпращаш профила за преглед.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard/new">
            <PlusIcon aria-hidden="true" />
            Добави бизнес
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <ul className="grid gap-3 md:grid-cols-2">
        {businesses.map((business) => (
          <li key={business.id}>
            <Link
              href={`/dashboard/${business.id}`}
              className="group flex h-full flex-col gap-3 rounded-lg border bg-card p-5 shadow-card transition-colors hover:border-primary/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={business.status} />
                <Badge variant="outline">{roleLabels[business.role]}</Badge>
              </div>
              <div>
                <p className="text-lg font-semibold group-hover:text-primary">
                  {business.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {business.category} · {business.city.name}
                </p>
              </div>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                Управлявай
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Button asChild variant="outline" className="justify-self-start">
        <Link href="/dashboard/new">
          <PlusIcon aria-hidden="true" />
          Добави още един бизнес
        </Link>
      </Button>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="За бизнеси"
        title="Моите бизнеси"
        description="Управлявай профила, адреса, работното време и услугите си."
      />
      <div className="container-page py-10">
        <Suspense fallback={<Skeleton className="h-48 max-w-xl" />}>
          <BusinessList />
        </Suspense>
      </div>
    </>
  );
}
