import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/features/auth/session";
import { BookingForm } from "@/features/bookings/components/booking-form";
import { getBookingOptions } from "@/features/bookings/queries";
import { businessPath } from "@/features/marketplace/format";

export const metadata: Metadata = {
  title: "Запази час",
  robots: { index: false },
};

async function BookingContent({
  params,
}: {
  params: PageProps<"/businesses/[city]/[slug]/book">["params"];
}) {
  const { city, slug } = await params;
  const path = businessPath(city, slug);
  const user = await requireUser(`${path}/book`);
  const options = await getBookingOptions(city, slug);
  if (!options) notFound();

  return (
    <>
      <div className="border-b bg-card">
        <div className="container-page py-3">
          <Breadcrumbs
            items={[
              { name: "Начало", href: "/" },
              { name: options.city.name, href: `/${options.city.slug}` },
              { name: options.name, href: path },
              { name: "Запази час", href: `${path}/book` },
            ]}
          />
        </div>
      </div>
      <div className="container-page grid max-w-3xl gap-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">
            Запази час в {options.name}
          </h1>
          {options.available && (
            <p className="mt-2 text-muted-foreground">
              {options.auto_confirm
                ? "Часът се потвърждава веднага."
                : "Бизнесът ще потвърди заявката ти. Ще получиш известие."}
            </p>
          )}
        </div>
        {options.available ? (
          <BookingForm
            options={options}
            customerName={user.fullName ?? ""}
            customerEmail={user.email}
          />
        ) : (
          <div className="grid gap-4 rounded-lg border bg-card p-6 shadow-card">
            <p>
              {options.is_demo
                ? "Това е демо профил. Онлайн резервации се приемат само от реални бизнеси."
                : "В момента бизнесът не приема онлайн резервации. Свържи се с тях по телефона."}
            </p>
            <Button asChild variant="outline" className="w-fit">
              <Link href={path}>Към профила</Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

export default function BookPage({
  params,
}: PageProps<"/businesses/[city]/[slug]/book">) {
  return (
    <Suspense
      fallback={
        <div className="container-page grid max-w-3xl gap-4 py-10">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-64" />
        </div>
      }
    >
      <BookingContent params={params} />
    </Suspense>
  );
}
