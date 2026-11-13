"use client";

import { CalendarCheckIcon, LoaderCircleIcon } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";

import { FormField } from "@/features/auth/components/form-field";
import { FormMessage } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/features/auth/form-state";
import { TextareaField } from "@/features/dashboard/components/fields";
import {
  formatDuration,
  formatPriceRange,
} from "@/features/marketplace/format";
import { cn } from "@/lib/utils";

import { createBooking, getSlots } from "../actions";
import { addDays, dayChipLabel } from "../format";
import type { BookingOptions, DaySlots } from "../types";

const MAX_DAYS_SHOWN = 30;

type SlotState =
  | { status: "loading" }
  | { status: "ready"; day: DaySlots }
  | { status: "error"; message: string };

export function BookingForm({
  options,
  customerName,
  customerEmail,
}: {
  options: BookingOptions;
  customerName: string;
  customerEmail: string;
}) {
  const [state, action] = useActionState(createBooking, initialFormState);
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const errors = state.fieldErrors ?? {};

  const days = Array.from(
    { length: Math.min(options.horizon_days, MAX_DAYS_SHOWN) + 1 },
    (_, index) => addDays(options.today, index),
  );
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState(days[0]);
  const [slots, setSlots] = useState<SlotState>({ status: "loading" });
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const serviceKey = serviceIds.join(",");
  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      setSlots({ status: "loading" });
      setStartsAt(null);
      const result = await getSlots({
        businessId: options.business_id,
        date,
        serviceIds: serviceKey ? serviceKey.split(",") : [],
      });
      if (cancelled) return;
      setSlots(
        result.ok
          ? { status: "ready", day: result.day }
          : { status: "error", message: result.message },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [options.business_id, date, serviceKey]);

  function toggleService(id: string) {
    setServiceIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length >= 5
          ? current
          : [...current, id],
    );
  }

  return (
    <form action={action} noValidate className="grid gap-6">
      <input type="hidden" name="businessId" value={options.business_id} />
      {startsAt && <input type="hidden" name="startsAt" value={startsAt} />}
      {serviceIds.map((id) => (
        <input key={id} type="hidden" name="serviceIds" value={id} />
      ))}
      <FormMessage state={state} />

      {options.services.length > 0 && (
        <fieldset className="grid gap-3 rounded-lg border bg-card p-5 shadow-card">
          <legend className="sr-only">Услуги</legend>
          <h2 className="font-semibold">1. Избери услуга</h2>
          <ul className="grid gap-2">
            {options.services.map((service) => {
              const price = formatPriceRange(
                service.price_from_cents,
                service.price_to_cents,
              );
              return (
                <li key={service.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm has-checked:border-primary has-checked:bg-accent/50">
                    <input
                      type="checkbox"
                      checked={serviceIds.includes(service.id)}
                      onChange={() => toggleService(service.id)}
                      className="size-4 accent-primary"
                    />
                    <span className="flex-1 font-medium">{service.name}</span>
                    <span className="text-muted-foreground">
                      {formatDuration(service.duration_minutes)}
                      {price && ` · ${price}`}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            Без избрана услуга се запазва {formatDuration(options.slot_minutes)}
            . Цените са ориентировъчни, крайната цена се уточнява на място.
          </p>
        </fieldset>
      )}

      <fieldset className="grid gap-4 rounded-lg border bg-card p-5 shadow-card">
        <legend className="sr-only">Дата и час</legend>
        <h2 className="font-semibold">
          {options.services.length > 0 ? "2. " : "1. "}Избери дата и час
        </h2>
        <div className="-mx-5 overflow-x-auto px-5">
          <ul className="flex min-w-max gap-2" aria-label="Дати">
            {days.map((day) => (
              <li key={day}>
                <button
                  type="button"
                  onClick={() => setDate(day)}
                  aria-pressed={day === date}
                  className={cn(
                    "h-10 rounded-md border px-3 text-sm font-medium whitespace-nowrap",
                    day === date
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card hover:bg-muted",
                  )}
                >
                  {dayChipLabel(day)}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div aria-live="polite" className="min-h-16">
          {slots.status === "loading" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircleIcon
                className="size-4 animate-spin"
                aria-hidden="true"
              />
              Зареждане на свободните часове…
            </p>
          )}
          {slots.status === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {slots.message}
            </p>
          )}
          {slots.status === "ready" &&
            (slots.day.slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Няма свободни часове в този ден. Избери друга дата.
              </p>
            ) : (
              <div className="grid gap-2">
                <p className="text-sm text-muted-foreground">
                  Продължителност: {formatDuration(slots.day.duration_minutes)}
                </p>
                <ul
                  aria-label="Свободни часове"
                  className="grid grid-cols-4 gap-2 sm:grid-cols-6"
                >
                  {slots.day.slots.map((slot) => (
                    <li key={slot.start}>
                      <button
                        type="button"
                        onClick={() => setStartsAt(slot.start)}
                        aria-pressed={slot.start === startsAt}
                        className={cn(
                          "h-10 w-full rounded-md border text-sm font-medium tabular-nums",
                          slot.start === startsAt
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card hover:bg-muted",
                        )}
                      >
                        {slot.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          {errors.startsAt && !startsAt && (
            <p className="mt-2 text-sm text-destructive">
              {errors.startsAt[0]}
            </p>
          )}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-lg border bg-card p-5 shadow-card">
        <legend className="sr-only">Данни за контакт</legend>
        <h2 className="font-semibold">
          {options.services.length > 0 ? "3. " : "2. "}Твоите данни
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            name="name"
            label="Име"
            autoComplete="name"
            required
            defaultValue={values.name ?? customerName}
            errors={errors.name}
          />
          <FormField
            name="phone"
            type="tel"
            label="Телефон"
            autoComplete="tel"
            required
            defaultValue={values.phone}
            errors={errors.phone}
          />
          <FormField
            name="make"
            label="Марка (по желание)"
            defaultValue={values.make}
            errors={errors.make}
          />
          <FormField
            name="model"
            label="Модел (по желание)"
            defaultValue={values.model}
            errors={errors.model}
          />
          <FormField
            name="plate"
            label="Рег. номер (по желание)"
            defaultValue={values.plate}
            errors={errors.plate}
          />
        </div>
        <TextareaField
          name="notes"
          label="Бележка към бизнеса (по желание)"
          rows={3}
          maxLength={1000}
          defaultValue={values.notes}
          errors={errors.notes}
        />
        <p className="text-xs text-muted-foreground">
          Потвърждението ще бъде изпратено на {customerEmail}. Бизнесът ще вижда
          името, телефона и имейла ти, за да се свърже с теб.
        </p>
      </fieldset>

      <SubmitButton pendingLabel="Изпращане…" className="w-full sm:w-fit">
        <CalendarCheckIcon aria-hidden="true" />
        {options.auto_confirm ? "Запази час" : "Изпрати заявка за час"}
      </SubmitButton>
    </form>
  );
}
