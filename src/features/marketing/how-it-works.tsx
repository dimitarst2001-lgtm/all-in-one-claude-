import { CalendarCheckIcon, MapPinnedIcon, SearchIcon } from "lucide-react";

import { Section } from "./section";

const steps = [
  {
    icon: MapPinnedIcon,
    title: "Избери град или местоположение",
    body: "Започни с града си или сподели местоположението си, ако искаш резултати по разстояние.",
  },
  {
    icon: SearchIcon,
    title: "Сравни услугите",
    body: "Филтрирай по категория, услуга, разстояние и работно време. Виж цени, когато бизнесът ги е посочил.",
  },
  {
    icon: CalendarCheckIcon,
    title: "Обади се или резервирай",
    body: "Свържи се директно или запази час онлайн, когато бизнесът приема резервации.",
  },
] as const;

export function HowItWorks() {
  return (
    <Section
      id="how-it-works"
      eyebrow="Как работи"
      title="Три стъпки до правилния сервиз"
      className="border-y bg-card"
    >
      <ol className="grid gap-8 md:grid-cols-3">
        {steps.map(({ icon: Icon, title, body }, index) => (
          <li key={title} className="relative">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-md border bg-background text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-muted-foreground">
                Стъпка {index + 1}
              </span>
            </div>
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
