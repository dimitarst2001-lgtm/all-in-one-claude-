import type { Metadata } from "next";
import Link from "next/link";
import { PhoneCallIcon } from "lucide-react";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { inCity } from "@/features/marketplace/format";
import { getCategories, getCities } from "@/features/marketplace/queries";
import { RoadsideForm } from "@/features/roadside/components/roadside-form";
import { RoadsideProviderCard } from "@/features/roadside/components/roadside-provider-card";
import { parseRoadsideParams } from "@/features/roadside/params";
import { getRoadsideProviders } from "@/features/roadside/queries";

export const metadata: Metadata = {
  title: "Пътна помощ",
  description:
    "Намери пътна помощ, която покрива мястото, където се намираш: репатриране, подаване на ток, смяна на гума, гориво. Обади се директно.",
  alternates: { canonical: "/roadside" },
};

const ROADSIDE_CATEGORY = "roadside-assistance";

export default function RoadsidePage({ searchParams }: PageProps<"/roadside">) {
  return (
    <>
      <PageHeader
        eyebrow="Пътна помощ"
        title="Закъса ли? Намери кой идва до теб"
        description="Показваме само фирми, които са обявили, че обслужват мястото, където се намираш. Обаждаш се директно на тях."
      />
      <div className="container-page grid gap-8 py-8 md:py-10">
        <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <PhoneCallIcon
            className="mt-0.5 size-4 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <span>
            При пътнотранспортно произшествие с пострадали или опасност на пътя
            звъни първо на{" "}
            <a href="tel:112" className="font-semibold underline">
              112
            </a>
            .
          </span>
        </p>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <RoadsideContent searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function RoadsideContent({
  searchParams,
}: Pick<PageProps<"/roadside">, "searchParams">) {
  const params = parseRoadsideParams(await searchParams);
  const [cities, categories] = await Promise.all([
    getCities(),
    getCategories(),
  ]);
  const services =
    categories.find((category) => category.slug === ROADSIDE_CATEGORY)
      ?.services ?? [];
  const service = services.find((item) => item.slug === params.service);
  const city = cities.find((item) => item.slug === params.city);
  const point =
    params.lat !== undefined && params.lng !== undefined
      ? { lat: params.lat, lng: params.lng }
      : city
        ? { lat: city.lat, lng: city.lng }
        : null;
  const usesOwnLocation = params.lat !== undefined;

  return (
    <div className="grid gap-8 lg:grid-cols-[22rem_1fr] lg:items-start">
      <RoadsideForm
        services={services}
        cities={cities}
        defaults={{
          service: service?.slug,
          city: city?.slug,
          lat: params.lat,
          lng: params.lng,
        }}
      />
      {point ? (
        <Results
          lat={point.lat}
          lng={point.lng}
          service={service ?? null}
          where={usesOwnLocation ? "около теб" : inCity(city?.name ?? "")}
          showDistance={usesOwnLocation}
          citySlug={city?.slug}
        />
      ) : (
        <div className="rounded-lg border bg-card p-6 text-sm shadow-card">
          <h2 className="text-base font-semibold">Как работи</h2>
          <ol className="mt-3 grid list-decimal gap-2 pl-5 text-muted-foreground">
            <li>Избери какъв е проблемът (по желание).</li>
            <li>Сподели местоположението си или избери град.</li>
            <li>
              Виж фирмите, които покриват мястото, и се обади директно на тях.
            </li>
          </ol>
          <p className="mt-4 text-muted-foreground">
            Обаждането не е поръчка през платформата. Цената и времето за
            пристигане уговаряш с фирмата по телефона.
          </p>
        </div>
      )}
    </div>
  );
}

async function Results({
  lat,
  lng,
  service,
  where,
  showDistance,
  citySlug,
}: {
  lat: number;
  lng: number;
  service: { slug: string; name: string } | null;
  where: string;
  showDistance: boolean;
  citySlug?: string;
}) {
  const result = await getRoadsideProviders(lat, lng, service?.slug ?? null);
  const heading = `${service?.name ?? "Пътна помощ"} ${where}`;

  return (
    <section aria-labelledby="roadside-results" className="grid gap-4">
      <div>
        <h2 id="roadside-results" className="text-xl font-semibold">
          {heading}
        </h2>
        <p className="text-sm text-muted-foreground">
          {result.total > 0
            ? `${result.total} ${result.total === 1 ? "фирма покрива" : "фирми покриват"} това място. Първо са тези, които работят в момента.`
            : "Няма фирма, обявила покритие за това място."}
        </p>
      </div>
      {result.items.map((provider) => (
        <RoadsideProviderCard
          key={provider.id}
          provider={provider}
          showDistance={showDistance}
        />
      ))}
      {result.total === 0 && (
        <p className="rounded-lg border bg-card p-5 text-sm shadow-card">
          Опитай без избран проблем или{" "}
          <Link
            href={`/search?category=${ROADSIDE_CATEGORY}${citySlug ? `&city=${citySlug}` : ""}`}
            className="font-medium text-primary hover:underline"
          >
            виж всички фирми за пътна помощ
          </Link>
          .
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Обаждането не е поръчка през платформата и не проследяваме автомобили.
        Цената и времето за пристигане уговаряш с фирмата.
      </p>
    </section>
  );
}
