import {
  BatteryChargingIcon,
  CircleAlertIcon,
  LifeBuoyIcon,
  PhoneCallIcon,
  PlugZapIcon,
} from "lucide-react";

export function SpotlightSections() {
  return (
    <section aria-label="Специализирани услуги" className="pb-16 md:pb-20">
      <div className="container-page grid gap-4 lg:grid-cols-2">
        <article className="flex flex-col rounded-lg surface-dark p-6 md:p-8">
          <span className="mb-5 flex size-11 items-center justify-center rounded-md bg-brand text-white">
            <LifeBuoyIcon className="size-5" aria-hidden="true" />
          </span>
          <h2 className="text-2xl font-semibold text-white">
            Пътна помощ, когато е спешно
          </h2>
          <p className="mt-3 text-navy-muted">
            Посочи къде си и какъв е проблемът. Ще видиш фирмите, които реално
            обслужват това място, и ще им се обадиш директно.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex gap-3">
              <PhoneCallIcon
                className="mt-0.5 size-4 shrink-0 text-brand"
                aria-hidden="true"
              />
              Директно обаждане към доставчика, без посредник.
            </li>
            <li className="flex gap-3">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0 text-brand"
                aria-hidden="true"
              />
              Местоположението е по желание. Можеш да въведеш адрес ръчно.
            </li>
          </ul>
        </article>

        <article className="flex flex-col rounded-lg border bg-card p-6 shadow-card md:p-8">
          <span className="mb-5 flex size-11 items-center justify-center rounded-md bg-accent text-primary">
            <PlugZapIcon className="size-5" aria-hidden="true" />
          </span>
          <h2 className="text-2xl font-semibold">
            Зарядни станции в цяла България
          </h2>
          <p className="mt-3 text-muted-foreground">
            Карта на публичните зарядни станции с тип конектор, мощност и AC/DC.
            Данните идват от Open Charge Map и показват кога са обновени за
            последно.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <BatteryChargingIcon
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              CCS, Type 2, CHAdeMO и други конектори.
            </li>
            <li className="flex gap-3">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              Не показваме заетост в реално време, когато източникът не я
              предоставя.
            </li>
          </ul>
        </article>
      </div>
    </section>
  );
}
