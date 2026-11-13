import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function BusinessCta() {
  return (
    <section aria-labelledby="business-cta-heading" className="py-16 md:py-20">
      <div className="container-page">
        <div className="flex flex-col gap-6 rounded-lg border bg-card p-6 shadow-card md:flex-row md:items-center md:justify-between md:p-10">
          <div className="max-w-2xl">
            <h2
              id="business-cta-heading"
              className="text-2xl font-semibold md:text-3xl"
            >
              Имаш автосервиз, автомивка или пътна помощ?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Създай профил, покажи услугите и цените си и приемай резервации
              онлайн. Абонаменти от €9.99 на месец.
            </p>
          </div>
          <Button asChild size="lg" className="shrink-0">
            <Link href="/for-businesses">
              Виж плановете
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
