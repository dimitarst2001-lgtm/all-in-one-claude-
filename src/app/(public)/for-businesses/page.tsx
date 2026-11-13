import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon, MailIcon, PlusIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { planPreviews } from "@/config/plans";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "За бизнеси",
  description:
    "Покажи автосервиза, автомивката или пътната си помощ пред клиенти във Варна и цяла България. Абонаменти от €9.99 на месец.",
  alternates: { canonical: "/for-businesses" },
};

const priceFormatter = new Intl.NumberFormat("bg-BG", {
  style: "currency",
  currency: "EUR",
});

export default function ForBusinessesPage() {
  const contactEmail = siteConfig.contact.email;

  return (
    <>
      <PageHeader
        eyebrow="За бизнеси"
        title="Повече клиенти за твоя автобизнес"
        description="Профил с услуги, цени, работно време и снимки. Онлайн резервации, когато ти е удобно. Ти решаваш как да се свързват с теб."
      />

      <section aria-labelledby="plans-heading" className="py-16 md:py-20">
        <div className="container-page">
          <div className="mb-10 max-w-2xl">
            <h2
              id="plans-heading"
              className="text-2xl font-semibold md:text-3xl"
            >
              Планове
            </h2>
            <p className="mt-3 text-muted-foreground">
              Месечен абонамент без дългосрочен договор. Цените са
              ориентировъчни за старта и може да бъдат променени преди
              официалното отваряне.
            </p>
          </div>

          <ul className="grid gap-4 lg:grid-cols-3">
            {planPreviews.map((plan) => (
              <li
                key={plan.code}
                className={cn(
                  "flex flex-col rounded-lg border bg-card p-6 shadow-card",
                  plan.highlight && "border-primary ring-1 ring-primary",
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  {plan.highlight && <Badge>Най-избиран</Badge>}
                </div>
                <p className="mt-4">
                  <span className="text-3xl font-semibold">
                    {priceFormatter.format(plan.priceEur)}
                  </span>
                  <span className="text-muted-foreground"> / месец</span>
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <CheckIcon
                        className="mt-0.5 size-4 shrink-0 text-success"
                        aria-hidden="true"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-lg border bg-accent/60 p-6">
            <h2 className="font-semibold">Създай бизнес профила си</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Регистрирай се, попълни профила и го изпрати за преглед. Всеки
              профил се преглежда от екипа ни, преди да стане публичен.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/dashboard/new">
                  <PlusIcon aria-hidden="true" />
                  Създай бизнес профил
                </Link>
              </Button>
              {contactEmail && (
                <Button asChild variant="outline">
                  <a
                    href={`mailto:${contactEmail}?subject=${encodeURIComponent("Регистрация на бизнес")}`}
                  >
                    <MailIcon aria-hidden="true" />
                    Пиши ни
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
