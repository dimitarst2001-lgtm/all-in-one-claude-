import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlockedDaysManager } from "@/features/bookings/components/blocked-days-manager";
import { BookingSettingsForm } from "@/features/bookings/components/booking-settings-form";
import { BusinessBookingList } from "@/features/bookings/components/business-booking-list";
import { DEFAULT_TIMEZONE, requestTime } from "@/features/bookings/format";
import {
  getBlockedDays,
  getBookingSettings,
  getBusinessBookings,
} from "@/features/bookings/queries";
import { bookingScopes, type BookingScope } from "@/features/bookings/types";
import { loadDashboardBusiness } from "@/features/dashboard/load";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Резервации",
  robots: { index: false },
};
// Private, per-user view: rendered on demand inside the layout's Suspense
// boundary rather than as an instant-navigation shell.
export const instant = false;

const tabs: { scope: BookingScope; label: string; empty: string }[] = [
  {
    scope: "upcoming",
    label: "Предстоящи",
    empty: "Няма предстоящи резервации.",
  },
  {
    scope: "pending",
    label: "Чакат потвърждение",
    empty: "Няма заявки, които чакат отговор.",
  },
  {
    scope: "past",
    label: "История",
    empty: "Още няма минали или отменени резервации.",
  },
];

export default async function BusinessBookingsPage({
  params,
  searchParams,
}: PageProps<"/dashboard/[businessId]/bookings">) {
  const { businessId } = await params;
  const { tab } = await searchParams;
  const scope: BookingScope = bookingScopes.includes(tab as BookingScope)
    ? (tab as BookingScope)
    : "upcoming";
  const base = `/dashboard/${businessId}/bookings`;
  const { business, canEdit } = await loadDashboardBusiness(businessId, base);

  const [settings, bookings, blocked] = await Promise.all([
    getBookingSettings(business.id),
    getBusinessBookings(business.id, scope),
    getBlockedDays(business.id),
  ]);
  if (!settings) notFound();

  const active = tabs.find((item) => item.scope === scope)!;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
  }).format(new Date());
  const notBookable =
    settings.booking_enabled &&
    !business.services.some(
      (service) => service.is_active && service.is_bookable,
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <section className="grid gap-4">
        <div>
          <h2 className="text-xl font-semibold">Резервации</h2>
          <p className="text-sm text-muted-foreground">
            Часовете са в местно време.
          </p>
        </div>
        {business.is_demo && (
          <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Това е демо профил. Демо профилите не приемат реални резервации.
          </p>
        )}
        {notBookable && (
          <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            Нямаш услуги, отбелязани за онлайн записване. Клиентите ще избират
            само час. Отбележи услуги в{" "}
            <Link
              href={`/dashboard/${business.id}/services`}
              className="font-medium text-primary hover:underline"
            >
              Услуги
            </Link>
            .
          </p>
        )}
        <nav aria-label="Филтър на резервациите">
          <ul className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <li key={item.scope}>
                <Link
                  href={
                    item.scope === "upcoming"
                      ? base
                      : `${base}?tab=${item.scope}`
                  }
                  aria-current={item.scope === scope ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium",
                    item.scope === scope
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card hover:bg-muted",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <BusinessBookingList
          businessId={business.id}
          bookings={bookings}
          showBay={(business.location?.capacity ?? 1) > 1}
          emptyText={active.empty}
          now={requestTime()}
        />
      </section>

      <aside className="grid gap-6">
        <BookingSettingsForm
          businessId={business.id}
          settings={settings}
          hasFeature={business.limits.online_booking}
          canEdit={canEdit}
        />
        <BlockedDaysManager
          businessId={business.id}
          items={blocked}
          today={today}
          canEdit={canEdit}
        />
      </aside>
    </div>
  );
}
