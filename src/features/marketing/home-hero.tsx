import Link from "next/link";
import { ArrowRightIcon, MapPinIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export function HomeHero() {
  return (
    <section className="relative overflow-hidden surface-dark">
      {/* Subtle road-grid texture; decorative only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_70%_20%,#000_20%,transparent_70%)] [background-size:56px_56px] opacity-[0.07]"
      />
      <div className="relative container-page grid gap-10 py-16 md:py-24 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-navy-foreground">
            <MapPinIcon className="size-4 text-brand" aria-hidden="true" />
            Стартираме във {siteConfig.launchCity}
          </p>
          <h1 className="text-4xl leading-[1.1] font-semibold text-white md:text-5xl lg:text-[3.4rem]">
            Намери правилната автоуслуга, където и да си.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-navy-muted">
            Открий доверени автосервизи, пътна помощ, гуми, автомивки и зарядни
            станции за електромобили в цяла България.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="brand" size="lg">
              <Link href="#categories">
                Разгледай услугите
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline-dark" size="lg">
              <Link href="/for-businesses">Имам бизнес</Link>
            </Button>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10">
          {[
            { term: "Категории услуги", value: "6" },
            { term: "Първи град", value: siteConfig.launchCity },
            { term: "За шофьорите", value: "Безплатно" },
            { term: "Следващи градове", value: "София, Пловдив, В. Търново" },
          ].map((stat) => (
            <div key={stat.term} className="bg-navy-800 p-5">
              <dt className="text-xs tracking-wide text-navy-muted uppercase">
                {stat.term}
              </dt>
              <dd className="mt-2 text-lg font-semibold text-white">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
