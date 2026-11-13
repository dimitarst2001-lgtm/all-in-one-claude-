import { categoryPreviews } from "@/config/categories";

import { Section } from "./section";

export function CategoryGrid() {
  return (
    <Section
      id="categories"
      eyebrow="Услуги"
      title="Всичко, от което колата ти има нужда"
      description="Шест категории с ясно описани услуги, работно време и начини за връзка."
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categoryPreviews.map(
          ({ slug, name, description, icon: Icon, examples }) => (
            <li
              key={slug}
              className="group flex flex-col rounded-lg border bg-card p-5 shadow-card transition-shadow hover:shadow-raised"
            >
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
            </li>
          ),
        )}
      </ul>
    </Section>
  );
}
