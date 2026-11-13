import Link from "next/link";

import { categoryPreviews } from "@/config/categories";
import { getCities } from "@/features/marketplace/queries";

import { Section } from "./section";

const LAUNCH_CITY = "varna";

export async function CategoryGrid() {
  const cities = await getCities();
  const launchCity = cities.find((city) => city.slug === LAUNCH_CITY);

  /** Link to the city landing page when it has listings, otherwise to search. */
  function hrefFor(slug: string): string | null {
    if (slug === "charging-stations") return null; // EV map ships in Phase 5.
    if (!launchCity) return null;
    return (launchCity.category_counts[slug] ?? 0) > 0
      ? `/${LAUNCH_CITY}/${slug}`
      : `/search?category=${slug}`;
  }

  return (
    <Section
      id="categories"
      eyebrow="Услуги"
      title="Всичко, от което колата ти има нужда"
      description="Шест категории с ясно описани услуги, работно време и начини за връзка."
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categoryPreviews.map(
          ({ slug, name, description, icon: Icon, examples }) => {
            const href = hrefFor(slug);
            const body = (
              <>
                <div className="flex items-start gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-semibold">{name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>
                <ul
                  className="mt-4 flex flex-wrap gap-1.5"
                  aria-label={`Примерни услуги: ${name}`}
                >
                  {examples.map((example) => (
                    <li
                      key={example}
                      className="rounded border bg-background px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {example}
                    </li>
                  ))}
                </ul>
              </>
            );
            const className =
              "flex h-full flex-col rounded-lg border bg-card p-5 shadow-card transition-shadow";
            return (
              <li key={slug}>
                {href ? (
                  <Link
                    href={href}
                    className={`${className} hover:shadow-raised`}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className={className}>{body}</div>
                )}
              </li>
            );
          },
        )}
      </ul>
    </Section>
  );
}
