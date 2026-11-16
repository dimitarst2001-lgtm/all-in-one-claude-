import type { Metadata } from "next";
import { InfoIcon } from "lucide-react";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ChargingFilters } from "@/features/charging/components/charging-filters";
import { StationCard } from "@/features/charging/components/station-card";
import { parseChargingParams } from "@/features/charging/params";
import { searchStations } from "@/features/charging/queries";
import { connectorLabels } from "@/features/charging/types";
import { BusinessMap } from "@/features/marketplace/components/business-map";
import { inCity } from "@/features/marketplace/format";
import { getCities } from "@/features/marketplace/queries";

export const metadata: Metadata = {
  title: "Зарядни станции за електромобили",
  description:
    "Карта на публичните зарядни станции в България с тип конектор, мощност и AC/DC. Данни от Open Charge Map.",
  alternates: { canonical: "/charging" },
};

const DEFAULT_CITY = "varna";

export default function ChargingPage({ searchParams }: PageProps<"/charging">) {
  return (
    <>
      <PageHeader
        eyebrow="Електромобили"
        title="Зарядни станции"
        description="Публичните зарядни станции около теб: конектори, мощност и бързо DC зареждане. Без регистрация и без абонамент."
      />
      <div className="container-page py-8 md:py-10">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <ChargingContent searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function ChargingContent({
  searchParams,
}: Pick<PageProps<"/charging">, "searchParams">) {
  const params = parseChargingParams(await searchParams);
  const cities = await getCities();
  const nearMe = params.lat !== undefined;
  const city =
    cities.find((item) => item.slug === params.city) ??
    cities.find((item) => item.slug === DEFAULT_CITY);
  const query = nearMe ? params : { ...params, city: city?.slug };
  const result = await searchStations(query);

  const imported = result.sources.some((source) => source.last_import_at);
  const filters = [
    params.connector && connectorLabels[params.connector],
    params.power && `от ${params.power} kW`,
    params.dc && "DC",
  ].filter(Boolean);
  const where = nearMe ? "около теб" : city ? inCity(city.name) : "";

  return (
    <div className="grid gap-8 lg:grid-cols-[18rem_1fr] lg:items-start">
      <ChargingFilters
        cities={cities.map(({ slug, name }) => ({ slug, name }))}
        defaults={{ ...params, city: city?.slug }}
      />
      <section
        aria-labelledby="charging-results"
        className="grid min-w-0 gap-4"
      >
        <div>
          <h2 id="charging-results" className="text-xl font-semibold">
            Зарядни станции {where}
            {filters.length > 0 && (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {filters.join(", ")}
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            {!imported
              ? "Данните за станциите още не са заредени."
              : result.total === 0
                ? "Няма станции, които отговарят на филтрите."
                : `${result.total} ${result.total === 1 ? "станция" : "станции"}${result.radius_km ? ` в радиус ${result.radius_km} км` : ""}${result.total > result.items.length ? `, показани са най-близките ${result.items.length}` : ""}.`}
          </p>
        </div>

        {result.items.length > 0 && (
          <BusinessMap
            className="h-80 md:h-96"
            label={`Карта на зарядните станции ${where}`}
            markers={result.items.map((station) => ({
              id: station.id,
              name: station.name,
              lat: station.lat,
              lng: station.lng,
              subtitle: [
                station.max_power_kw !== null &&
                  `до ${station.max_power_kw.toLocaleString("bg-BG")} kW`,
                station.has_dc && "DC",
              ]
                .filter(Boolean)
                .join(" · "),
            }))}
          />
        )}

        <div className="grid gap-3 xl:grid-cols-2">
          {result.items.map((station) => (
            <StationCard
              key={station.id}
              station={station}
              showDistance={nearMe}
            />
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="grid gap-1">
            <p>
              Не показваме заетост в реално време. Статусът и цените са такива,
              каквито ги дава източникът, и може да не са актуални.
            </p>
            {result.sources.map((source) => (
              <p key={source.name}>
                {source.attribution} (
                {source.website ? (
                  <a
                    href={source.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {source.name}
                  </a>
                ) : (
                  source.name
                )}
                , {source.license}){!source.last_import_at && "."}
                {source.last_import_at &&
                  `. Заредено при нас на ${new Intl.DateTimeFormat("bg-BG", {
                    dateStyle: "medium",
                    timeZone: "Europe/Sofia",
                  }).format(new Date(source.last_import_at))}`}
              </p>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
