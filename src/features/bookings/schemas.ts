import { z } from "zod";

import { phoneSchema } from "@/features/dashboard/schemas";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Избери дата." });

const optionalShort = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "Текстът е твърде дълъг." })
    .optional()
    .transform((value) => value || undefined);

const checkbox = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");

/** A customer's booking request, as submitted by the booking form. */
export const bookingRequestSchema = z.object({
  businessId: z.uuid(),
  serviceIds: z
    .array(z.uuid())
    .max(5, { error: "Избери до 5 услуги." })
    .transform((ids) => [...new Set(ids)]),
  startsAt: z.iso.datetime({ offset: true, error: "Избери час." }),
  name: z
    .string()
    .trim()
    .min(2, { error: "Въведи име." })
    .max(120, { error: "Името е твърде дълго." }),
  phone: phoneSchema,
  make: optionalShort(40),
  model: optionalShort(40),
  plate: optionalShort(12),
  notes: optionalShort(1000),
});
export type BookingRequest = z.infer<typeof bookingRequestSchema>;

export const slotQuerySchema = z.object({
  businessId: z.uuid(),
  date: isoDate,
  serviceIds: z.array(z.uuid()).max(5),
});

const intInRange = (min: number, max: number, message: string) =>
  z.coerce
    .number<string>({ error: message })
    .int({ error: message })
    .min(min, { error: message })
    .max(max, { error: message });

export const slotLengths = [15, 20, 30, 45, 60, 90, 120] as const;

export const bookingSettingsSchema = z.object({
  enabled: checkbox,
  autoConfirm: checkbox,
  slotMinutes: z.coerce
    .number<string>()
    .refine((value) => (slotLengths as readonly number[]).includes(value), {
      error: "Избери стъпка.",
    }),
  bufferMinutes: intInRange(0, 240, "Между 0 и 240 минути."),
  leadHours: intInRange(0, 168, "Между 0 и 168 часа."),
  horizonDays: intInRange(1, 180, "Между 1 и 180 дни."),
});

export const blockedDaysSchema = z
  .object({
    from: isoDate,
    to: isoDate,
    reason: optionalShort(200),
  })
  .refine((value) => value.to >= value.from, {
    error: "Крайната дата трябва да е след началната.",
    path: ["to"],
  });

export const businessStatusChanges = [
  "confirmed",
  "rejected",
  "cancelled",
  "completed",
  "no_show",
] as const;

export const statusChangeSchema = z.object({
  status: z.enum(businessStatusChanges),
  reason: optionalShort(500),
});
