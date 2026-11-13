import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { categoryPreviews } from "@/config/categories";
import { BusinessCard } from "@/features/marketplace/components/business-card";
import { SearchForm } from "@/features/marketplace/components/search-form";
import { inCity } from "@/features/marketplace/format";
import {
  getCategories,
  getCities,
  getCity,
  searchBusinesses,
} from "@/features/marketplace/queries";

export async function generateStaticParams() {
  const cities = await getCities().catch(() => []);
  return cities.length > 0
    ? cities.map((city) => ({ city: city.slug }))
    : [{ city: "varna" }];
}

export async function generateMetadata({
  params,
}: PageProps<"/[city]">): Promise<Metadata> {
  const city = await getCity((await params).city);
  if (!city) return { title: "Градът не е намерен", robots: { index: false } };
  const total = Object.values(city.category_counts).reduce(
    (sum, count) => sum + count,
    0,
  );

  return {
    title: `Автоуслуги ${inCity(city.name)}`,
    description: `Автосервизи, пътна помощ, гуми, автомивки и детайлинг ${inCity(city.name)}. Адреси, телефони и работно време.`,
    alternates: { canonical: `/${city.slug}` },
    // A city without listings is not worth indexing yet.
    robots: total === 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function CityPage({ params }: PageProps<"/[city]">) {
  const citySlug = (await params).city;
  const [city, cities, categories] = await Promise.all([
    getCity(citySlug),
    getCities(),
    getCategories(),
  ]);
  if (!city) notFound();

  const featured = await searchBusinesses({ city: city.slug }, 6);
  const icons = new Map(
    categoryPreviews.map((preview) => [preview.slug, preview.icon]),
  );

  return (
    <>
      <section className="surface-dark">
        <div className="container-page grid gap-8 py-10 md:py-14 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <Breadcrumbs
              tone="dark"
              items={[
                { name: "Начало", href: "/" },
                { name: city.name, href: `/${city.slug}` },
              ]}
            />
            <h1 className="mt-4 text-3xl font-semibold text-white md:text-4xl">
              Автоуслуги {inCity(city.name)}
            </h1>
            <p className="mt-3 max-w-xl text-navy-muted">
              Намери сервиз, пътна помощ, гуми, автомивка или детайлинг{" "}
              {inCity(city.name)} и се свържи директно.
            </p>
          </div>
          <SearchForm
            variant="hero"
            cities={cities}
            categories={categories.map(({ slug, name, services }) => ({
              slug,
              name,
              services,
            }))}
            defaults={{ city: city.slug }}
          />
        </div>
      </section>

      <section
        aria-labelledby="city-categories"
        className="container-page py-12"
      >
        <h2 id="city-categories" className="mb-6 text-2xl font-semibold">
          Категории {inCity(city.name)}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const count = city.category_counts[category.slug] ?? 0;
            const Icon = icons.get(category.slug);
            const content = (
              <>
                {Icon && (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{category.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {count === 0
                      ? "Скоро"
                      : count === 1
                        ? "1 бизнес"
                        : `${count} бизнеса`}
                  </span>
                </span>
              </>
            );
            return (
              <li key={category.slug}>
                {count > 0 ? (
                  <Link
                    href={`/${city.slug}/${category.slug}`}
                    className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-card transition-shadow hover:shadow-raised"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-dashed bg-card/60 p-4 opacity-80">
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {featured.items.length > 0 && (
        <section
          aria-labelledby="city-featured"
          className="container-page pb-16"
        >
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 id="city-featured" className="text-2xl font-semibold">
              Бизнеси {inCity(city.name)}
            </h2>
            <Link
              href={`/search?city=${city.slug}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Виж всички
            </Link>
          </div>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featured.items.map((business) => (
              <li key={business.id} className="flex">
                <BusinessCard
                  business={business}
                  showDistance={false}
                  className="w-full"
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
