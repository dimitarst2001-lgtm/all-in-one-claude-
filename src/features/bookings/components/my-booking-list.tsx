"use client";

import Link from "next/link";
import { MapPinIcon, PhoneIcon } from "lucide-react";
import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/features/auth/components/form-message";
import { initialFormState } from "@/features/auth/form-state";
import { businessPath, telHref } from "@/features/marketplace/format";

import { cancelMyBooking } from "../actions";
import { formatBookingRange } from "../format";
import { bookingStatusLabels, type MyBooking } from "../types";

function MyBookingCard({
  booking,
  highlight,
  now,
}: {
  booking: MyBooking;
  highlight: boolean;
  now: number;
}) {
  const [state, cancel, pending] = useActionState(
    cancelMyBooking.bind(null, booking.id),
    initialFormState,
  );
  const upcoming = new Date(booking.starts_at).getTime() > now;
  const cancellable =
    upcoming &&
    (booking.status === "pending" || booking.status === "confirmed");

  return (
    <li
      className={
        highlight
          ? "grid gap-3 rounded-lg border border-primary bg-card p-5 shadow-card"
          : "grid gap-3 rounded-lg border bg-card p-5 shadow-card"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold first-letter:uppercase">
            {formatBookingRange(booking.starts_at, booking.ends_at)}
          </p>
          <Link
            href={businessPath(
              booking.business.city_slug,
              booking.business.slug,
            )}
            className="text-primary hover:underline"
          >
            {booking.business.name}
          </Link>
        </div>
        <Badge
          variant={
            booking.status === "confirmed"
              ? "success"
              : booking.status === "pending"
                ? "warning"
                : booking.status === "rejected"
                  ? "destructive"
                  : "outline"
          }
        >
          {bookingStatusLabels[booking.status]}
        </Badge>
      </div>
      <div className="grid gap-1 text-sm text-muted-foreground">
        {booking.services.length > 0 && <p>{booking.services.join(", ")}</p>}
        <p className="inline-flex items-center gap-1.5">
          <MapPinIcon className="size-3.5" aria-hidden="true" />
          {booking.address}
        </p>
        {booking.business.phone && (
          <a
            href={telHref(booking.business.phone)}
            className="inline-flex w-fit items-center gap-1.5 text-primary hover:underline"
          >
            <PhoneIcon className="size-3.5" aria-hidden="true" />
            {booking.business.phone}
          </a>
        )}
        {booking.status_reason && <p>Причина: {booking.status_reason}</p>}
      </div>
      {cancellable && (
        <form
          action={cancel}
          onSubmit={(event) => {
            if (!window.confirm("Да отменим ли резервацията?")) {
              event.preventDefault();
            }
          }}
        >
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={pending}
            className="text-destructive hover:text-destructive"
          >
            Отмени резервацията
          </Button>
        </form>
      )}
      {state.status === "error" && <FormMessage state={state} />}
    </li>
  );
}

export function MyBookingList({
  bookings,
  highlightId,
  now,
}: {
  bookings: MyBooking[];
  highlightId?: string;
  /** Render time from the server, to decide which bookings can be cancelled. */
  now: number;
}) {
  return (
    <ul className="grid gap-4">
      {bookings.map((booking) => (
        <MyBookingCard
          key={booking.id}
          booking={booking}
          highlight={booking.id === highlightId}
          now={now}
        />
      ))}
    </ul>
  );
}
