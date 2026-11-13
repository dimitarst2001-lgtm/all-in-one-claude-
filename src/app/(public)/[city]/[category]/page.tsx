import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ResultsSection } from "@/features/marketplace/components/results-section";
import { inCity } from "@/features/marketplace/format";
import {
  getCategory,
  getCities,
  getCity,
  searchBusinesses,
} from "@/features/marketplace/queries";

const LANDING_LIMIT = 50;

/** Only city/category pairs that actually have listings get a landing page. */
export async function generateStaticParams() {
  const cities = await getCities().catch(() => []);
  const params = cities.flatMap((city) =>
    Object.entries(city.category_counts)
      .filter(([, count]) => count > 0)
      .map(([category]) => ({ city: city.slug, category })),
  );
  return params.length > 0
    ? params
    : [{ city: "varna", category: "auto-repair" }];
}

async function loadLanding(citySlug: string, categorySlug: string) {
  const [city, category] = await Promise.all([
    getCity(citySlug),
    getCategory(categorySlug),
  ]);
  if (!city || !category || (city.category_counts[category.slug] ?? 0) === 0)
    return null;
  return { city, category };
}

export async function generateMetadata({
  params,
}: PageProps<"/[city]/[category]">): Promise<Metadata> {
  const { city: citySlug, category: categorySlug } = await params;
  const landing = await loadLanding(citySlug, categorySlug);
  if (!landing)
    return { title: "Страницата не е намерена", robots: { index: false } };
  const { city, category } = landing;

  const title = `${category.name} ${inCity(city.name)}`;
  return {
    title,
    description: `${category.name} ${inCity(city.name)}: сравни адреси, услуги, цени и работно време и се свържи директно.`,
    alternates: { canonical: `/${city.slug}/${category.slug}` },
    openGraph: { title, url: `/${city.slug}/${category.slug}` },
  };
}

export default async function CityCategoryPage({
  params,
}: PageProps<"/[city]/[category]">) {
  const { city: citySlug, category: categorySlug } = await params;
  const landing = await loadLanding(citySlug, categorySlug);
  if (!landing) notFound();
  const { city, category } = landing;

  const result = await searchBusinesses(
    { city: city.slug, category: category.slug },
    LANDING_LIMIT,
  );
  if (result.total === 0) notFound();

  return (
    <>
      <section className="surface-dark">
        <div className="container-page py-8 md:py-10">
          <Breadcrumbs
            tone="dark"
            items={[
              { name: "Начало", href: "/" },
              { name: city.name, href: `/${city.slug}` },
              { name: category.name, href: `/${city.slug}/${category.slug}` },
            ]}
          />
          <h1 className="mt-4 text-3xl font-semibold text-white md:text-4xl">
            {category.name} {inCity(city.name)}
          </h1>
          {category.description && (
            <p className="mt-3 max-w-2xl text-navy-muted">
              {category.description}
            </p>
          )}
          {category.services.length > 0 && (
            <ul
              className="mt-5 flex flex-wrap gap-2"
              aria-label="Филтрирай по услуга"
            >
              {category.services.map((service) => (
                <li key={service.slug}>
                  <Link
                    href={`/search?city=${city.slug}&category=${category.slug}&service=${service.slug}`}
                    className="inline-block rounded-md border border-white/15 px-2.5 py-1 text-sm text-navy-foreground hover:bg-white/10"
                  >
                    {service.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="container-page grid gap-5 py-8 md:py-10">
        <p className="text-sm text-muted-foreground">
          {result.total === 1 ? "1 бизнес" : `${result.total} бизнеса`}.{" "}
          <Link
            href={`/search?city=${city.slug}&category=${category.slug}`}
            className="font-medium text-primary hover:underline"
          >
            Филтрирай по разстояние, работно време и резервации
          </Link>
        </p>
        <ResultsSection
          result={result}
          mapLabel={`Карта: ${category.name} ${inCity(city.name)}`}
        />
      </div>
    </>
  );
}
