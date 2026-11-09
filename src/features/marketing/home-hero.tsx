import { MapPinIcon } from "lucide-react";

import { siteConfig } from "@/config/site";
import { SearchForm } from "@/features/marketplace/components/search-form";
import { getCategories, getCities } from "@/features/marketplace/queries";

export async function HomeHero() {
  const [cities, categories] = await Promise.all([
    getCities(),
    getCategories(),
  ]);

  return (
    <section className="relative overflow-hidden surface-dark">
      {/* Subtle road-grid texture; decorative only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_70%_20%,#000_20%,transparent_70%)] [background-size:56px_56px] opacity-[0.07]"
      />
      <div className="relative container-page grid gap-10 py-14 md:py-20 lg:grid-cols-[1fr_1.15fr] lg:items-center">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-navy-foreground">
            <MapPinIcon className="size-4 text-brand" aria-hidden="true" />
            Стартираме във {siteConfig.launchCity}
          </p>
          <h1 className="text-4xl leading-[1.1] font-semibold text-white md:text-5xl">
            Намери правилната автоуслуга, където и да си.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-navy-muted">
            Открий доверени автосервизи, пътна помощ, гуми, автомивки и зарядни
            станции за електромобили в цяла България.
          </p>
        </div>

        {cities.length > 0 ? (
          <SearchForm
            variant="hero"
            cities={cities}
            categories={categories.map(({ slug, name, services }) => ({
              slug,
              name,
              services,
            }))}
          />
        ) : (
          <p className="rounded-lg border border-white/10 bg-navy-800/80 p-5 text-navy-muted">
            Търсенето ще бъде достъпно след свързване на базата данни.
          </p>
        )}
      </div>
    </section>
  );
}
