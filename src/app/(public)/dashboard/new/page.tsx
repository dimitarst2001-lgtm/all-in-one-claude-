import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/features/auth/session";
import { CreateBusinessForm } from "@/features/dashboard/components/create-business-form";
import { getCategories, getCities } from "@/features/marketplace/queries";

export const metadata: Metadata = {
  title: "Нов бизнес профил",
  robots: { index: false },
};

async function NewBusiness() {
  await requireUser("/dashboard/new");
  const [cities, categories] = await Promise.all([
    getCities(),
    getCategories(),
  ]);

  if (cities.length === 0 || categories.length === 0) {
    return (
      <p className="max-w-xl rounded-lg border bg-card p-6 text-muted-foreground">
        Създаването на профили временно не е достъпно. Опитай отново по-късно.
      </p>
    );
  }

  return (
    <div className="max-w-3xl">
      <CreateBusinessForm
        cities={cities.map(({ slug, name, lat, lng }) => ({
          slug,
          name,
          lat,
          lng,
        }))}
        categories={categories.map(({ slug, name }) => ({ slug, name }))}
      />
    </div>
  );
}

export default function NewBusinessPage() {
  return (
    <>
      <PageHeader
        eyebrow="За бизнеси"
        title="Нов бизнес профил"
        description="Започни с основните данни. Всичко останало можеш да добавиш след това."
      />
      <div className="container-page py-10">
        <Suspense fallback={<Skeleton className="h-96 max-w-3xl" />}>
          <NewBusiness />
        </Suspense>
      </div>
    </>
  );
}
