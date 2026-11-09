import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/features/marketplace/components/pagination";
import { ResultsSection } from "@/features/marketplace/components/results-section";
import { SearchForm } from "@/features/marketplace/components/search-form";
import { SortLinks } from "@/features/marketplace/components/sort-links";
import { inCity } from "@/features/marketplace/format";
import {
  getCategories,
  getCities,
  searchBusinesses,
} from "@/features/marketplace/queries";
import {
  PAGE_SIZE,
  parseSearchParams,
  toQueryString,
} from "@/features/marketplace/search-params";

export const metadata: Metadata = {
  title: "Търсене на автоуслуги",
  description:
    "Търси автосервизи, пътна помощ, гуми, автомивки и детайлинг по град, услуга и разстояние.",
  // Faceted result pages are not indexed; city/category landing pages are.
  robots: { index: false, follow: true },
  alternates: { canonical: "/search" },
};

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="container-page py-8 md:py-10">
      <Suspense fallback={<SearchSkeleton />}>
        <SearchContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchContent({
  searchParams,
}: Pick<PageProps<"/search">, "searchParams">) {
  const filters = parseSearchParams(await searchParams);
  const [cities, categories, result] = await Promise.all([
    getCities(),
    getCategories(),
    searchBusinesses(filters),
  ]);

  const city = cities.find((item) => item.slug === filters.city);
  const category = categories.find((item) => item.slug === filters.category);
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const page = Math.min(filters.page ?? 1, totalPages);
  const hasUserLocation = filters.lat !== undefined;

  const heading = [
    category?.name ?? "Автоуслуги",
    city ? inCity(city.name) : hasUserLocation ? "около теб" : "в България",
  ].join(" ");

  return (
    <div className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside
        aria-label="Филтри за търсене"
        className="lg:sticky lg:top-20 lg:self-start"
      >
        <SearchForm
          variant="panel"
          cities={cities}
          categories={categories.map(({ slug, name, services }) => ({
            slug,
            name,
            services,
          }))}
          defaults={filters}
        />
      </aside>

      <section aria-labelledby="results-heading" className="grid min-w-0 gap-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              id="results-heading"
              className="text-2xl font-semibold md:text-3xl"
            >
              {heading}
            </h1>
            <p
              className="mt-1 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {result.total === 1 ? "1 резултат" : `${result.total} резултата`}
              {filters.radius &&
                ` до ${filters.radius} км ${hasUserLocation ? "от теб" : "от центъра"}`}
            </p>
          </div>
          <SortLinks
            basePath="/search"
            filters={filters}
            hasUserLocation={hasUserLocation}
            hasRatings={result.items.some((item) => item.rating_count > 0)}
          />
        </div>

        <ResultsSection
          result={result}
          center={
            hasUserLocation
              ? { lat: filters.lat!, lng: filters.lng! }
              : undefined
          }
          mapLabel={`Карта: ${heading}`}
          footer={
            <Pagination
              page={page}
              totalPages={totalPages}
              hrefForPage={(target) =>
                `/search${toQueryString(filters, { page: target })}`
              }
            />
          }
        />
      </section>
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div
      className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]"
      aria-busy="true"
      aria-label="Зареждане на резултати"
    >
      <Skeleton className="h-96" />
      <div className="grid gap-4">
        <Skeleton className="h-10 w-2/3" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-48" />
          ))}
        </div>
      </div>
    </div>
  );
}
