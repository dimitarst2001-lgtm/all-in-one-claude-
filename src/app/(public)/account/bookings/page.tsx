import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/features/auth/session";
import { MyBookingList } from "@/features/bookings/components/my-booking-list";
import { getMyBookings } from "@/features/bookings/queries";
import { requestTime } from "@/features/bookings/format";

export const metadata: Metadata = {
  title: "Моите резервации",
  robots: { index: false },
};

async function MyBookings({
  searchParams,
}: {
  searchParams: PageProps<"/account/bookings">["searchParams"];
}) {
  await requireUser("/account/bookings");
  const { booked } = await searchParams;
  const bookings = await getMyBookings();
  const justBooked = bookings.find((booking) => booking.id === booked);

  return (
    <div className="grid max-w-2xl gap-6">
      {justBooked && (
        <p
          role="status"
          className="rounded-md border border-success/30 bg-success/5 p-3 text-sm text-success"
        >
          {justBooked.status === "confirmed"
            ? "Готово! Часът ти е потвърден."
            : "Заявката е изпратена. Ще получиш известие, когато бизнесът я потвърди."}
        </p>
      )}
      {bookings.length > 0 ? (
        <MyBookingList
          bookings={bookings}
          highlightId={typeof booked === "string" ? booked : undefined}
          now={requestTime()}
        />
      ) : (
        <div className="rounded-lg border bg-card p-6 text-sm shadow-card">
          <p>Още нямаш резервации.</p>
          <Link
            href="/search?booking=1"
            className="mt-2 inline-block font-medium text-primary hover:underline"
          >
            Намери бизнес с онлайн записване
          </Link>
        </div>
      )}
    </div>
  );
}

export default function MyBookingsPage({
  searchParams,
}: PageProps<"/account/bookings">) {
  return (
    <>
      <PageHeader title="Моите резервации" />
      <div className="container-page py-10">
        <Suspense fallback={<Skeleton className="h-48 max-w-2xl" />}>
          <MyBookings searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}
