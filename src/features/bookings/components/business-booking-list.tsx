"use client";

import { CarIcon, MailIcon, PhoneIcon } from "lucide-react";
import { useActionState, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/features/auth/form-state";

import { changeBookingStatus } from "../actions";
import { formatBookingDate, formatBookingTime } from "../format";
import {
  bookingStatusLabels,
  type BookingStatus,
  type BusinessBooking,
} from "../types";

const statusVariant: Record<
  BookingStatus,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  pending: "warning",
  confirmed: "success",
  rejected: "destructive",
  cancelled: "outline",
  completed: "secondary",
  no_show: "outline",
};

function StatusButton({
  businessId,
  bookingId,
  status,
  label,
  variant = "outline",
  askReason,
}: {
  businessId: string;
  bookingId: string;
  status: string;
  label: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  askReason?: boolean;
}) {
  const [state, action] = useActionState(
    changeBookingStatus.bind(null, businessId, bookingId),
    initialFormState,
  );
  const [open, setOpen] = useState(false);

  if (askReason && !open) {
    return (
      <Button
        type="button"
        size="sm"
        variant={variant}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
    );
  }

  return (
    <form action={action} className="grid w-full gap-2 sm:w-auto">
      <input type="hidden" name="status" value={status} />
      {askReason && (
        <div className="grid gap-2">
          <label htmlFor={`reason-${bookingId}-${status}`} className="text-sm">
            Причина (вижда я клиентът, по желание)
          </label>
          <textarea
            id={`reason-${bookingId}-${status}`}
            name="reason"
            maxLength={500}
            rows={2}
            className="rounded-md border bg-card px-3 py-2 text-sm"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <SubmitButton
          pendingLabel="Запазване…"
          variant={variant}
          className="h-8 w-auto px-3"
        >
          {label}
        </SubmitButton>
        {askReason && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setOpen(false)}
          >
            Назад
          </Button>
        )}
      </div>
      {state.status === "error" && <FormMessage state={state} />}
    </form>
  );
}

function BookingRow({
  businessId,
  booking,
  showBay,
  now,
}: {
  businessId: string;
  booking: BusinessBooking;
  showBay: boolean;
  now: number;
}) {
  const started = new Date(booking.starts_at).getTime() <= now;
  const vehicle = booking.vehicle
    ? [booking.vehicle.make, booking.vehicle.model, booking.vehicle.plate]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <li className="grid gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {formatBookingTime(booking.starts_at)}–
            {formatBookingTime(booking.ends_at)}
            {showBay && (
              <span className="font-normal text-muted-foreground">
                {" "}
                · място {booking.bay_number}
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            {booking.services.length
              ? booking.services.join(", ")
              : "Без избрана услуга"}
          </p>
        </div>
        <Badge variant={statusVariant[booking.status]}>
          {bookingStatusLabels[booking.status]}
        </Badge>
      </div>
      <div className="grid gap-1 text-sm">
        <p className="font-medium">{booking.customer_name}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <a
            href={`tel:${booking.customer_phone}`}
            className="inline-flex items-center gap-1.5 text-primary hover:underline"
          >
            <PhoneIcon className="size-3.5" aria-hidden="true" />
            {booking.customer_phone}
          </a>
          <a
            href={`mailto:${booking.customer_email}`}
            className="inline-flex items-center gap-1.5 break-all text-primary hover:underline"
          >
            <MailIcon className="size-3.5" aria-hidden="true" />
            {booking.customer_email}
          </a>
        </p>
        {vehicle && (
          <p className="inline-flex items-center gap-1.5 text-muted-foreground">
            <CarIcon className="size-3.5" aria-hidden="true" />
            {vehicle}
          </p>
        )}
        {booking.notes && (
          <p className="rounded-md bg-muted/50 p-2 text-muted-foreground">
            {booking.notes}
          </p>
        )}
        {booking.status_reason && (
          <p className="text-muted-foreground">
            Причина: {booking.status_reason}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {booking.status === "pending" && (
          <>
            <StatusButton
              businessId={businessId}
              bookingId={booking.id}
              status="confirmed"
              label="Потвърди"
              variant="default"
            />
            <StatusButton
              businessId={businessId}
              bookingId={booking.id}
              status="rejected"
              label="Откажи"
              askReason
            />
          </>
        )}
        {booking.status === "confirmed" && started && (
          <>
            <StatusButton
              businessId={businessId}
              bookingId={booking.id}
              status="completed"
              label="Изпълнена"
              variant="default"
            />
            <StatusButton
              businessId={businessId}
              bookingId={booking.id}
              status="no_show"
              label="Не дойде"
            />
          </>
        )}
        {booking.status === "confirmed" && !started && (
          <StatusButton
            businessId={businessId}
            bookingId={booking.id}
            status="cancelled"
            label="Отмени"
            askReason
          />
        )}
      </div>
    </li>
  );
}

/** Bookings grouped by local day. */
export function BusinessBookingList({
  businessId,
  bookings,
  showBay,
  emptyText,
  now,
}: {
  businessId: string;
  bookings: BusinessBooking[];
  showBay: boolean;
  emptyText: string;
  /** Render time from the server, to decide which actions apply. */
  now: number;
}) {
  if (bookings.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground shadow-card">
        {emptyText}
      </p>
    );
  }

  const days = new Map<string, BusinessBooking[]>();
  for (const booking of bookings) {
    const day = formatBookingDate(booking.starts_at);
    days.set(day, [...(days.get(day) ?? []), booking]);
  }

  return (
    <div className="grid gap-4">
      {[...days].map(([day, items]) => (
        <section
          key={day}
          aria-label={day}
          className="rounded-lg border bg-card p-5 shadow-card"
        >
          <h3 className="mb-3 font-semibold first-letter:uppercase">{day}</h3>
          <ul className="divide-y">
            {items.map((booking) => (
              <BookingRow
                key={booking.id}
                businessId={businessId}
                booking={booking}
                showBay={showBay}
                now={now}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
