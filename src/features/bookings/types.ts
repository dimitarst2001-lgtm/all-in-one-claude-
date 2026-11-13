import { z } from "zod";

export const bookingStatuses = [
  "pending",
  "confirmed",
  "rejected",
  "cancelled",
  "completed",
  "no_show",
] as const;
export const bookingStatusSchema = z.enum(bookingStatuses);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const bookingStatusLabels: Record<BookingStatus, string> = {
  pending: "Чака потвърждение",
  confirmed: "Потвърдена",
  rejected: "Отказана от бизнеса",
  cancelled: "Отменена",
  completed: "Изпълнена",
  no_show: "Клиентът не дойде",
};

const timestamp = z.string().min(1);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const slotsSchema = z.object({
  date: isoDate,
  timezone: z.string(),
  duration_minutes: z.number().int(),
  slots: z.array(z.object({ start: timestamp, label: z.string() })),
});
export type DaySlots = z.infer<typeof slotsSchema>;

export const bookingOptionsSchema = z.object({
  business_id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  is_demo: z.boolean(),
  booking_enabled: z.boolean(),
  available: z.boolean(),
  auto_confirm: z.boolean(),
  slot_minutes: z.number().int(),
  lead_hours: z.number().int(),
  horizon_days: z.number().int(),
  today: isoDate,
  city: z.object({ slug: z.string(), name: z.string() }),
  services: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      duration_minutes: z.number().int(),
      price_from_cents: z.number().int().nullable(),
      price_to_cents: z.number().int().nullable(),
    }),
  ),
});
export type BookingOptions = z.infer<typeof bookingOptionsSchema>;

export const bookingNoticeSchema = z.object({
  id: z.uuid(),
  status: bookingStatusSchema,
  status_reason: z.string().nullable(),
  starts_at: timestamp,
  ends_at: timestamp,
  timezone: z.string(),
  customer_name: z.string(),
  customer_email: z.string(),
  customer_phone: z.string(),
  business_id: z.uuid(),
  business_name: z.string(),
  business_email: z.string().nullable(),
  business_phone: z.string().nullable(),
  address: z.string(),
  city_name: z.string(),
  services: z.array(z.string()),
});
export type BookingNotice = z.infer<typeof bookingNoticeSchema>;

const vehicleSchema = z
  .object({
    make: z.string().optional(),
    model: z.string().optional(),
    plate: z.string().optional(),
  })
  .nullable();

export const businessBookingSchema = z.object({
  id: z.uuid(),
  status: bookingStatusSchema,
  status_reason: z.string().nullable(),
  starts_at: timestamp,
  ends_at: timestamp,
  bay_number: z.number().int(),
  customer_name: z.string(),
  customer_email: z.string(),
  customer_phone: z.string(),
  vehicle: vehicleSchema,
  notes: z.string().nullable(),
  created_at: timestamp,
  services: z.array(z.string()),
});
export type BusinessBooking = z.infer<typeof businessBookingSchema>;

export const myBookingSchema = z.object({
  id: z.uuid(),
  status: bookingStatusSchema,
  status_reason: z.string().nullable(),
  starts_at: timestamp,
  ends_at: timestamp,
  business: z.object({
    name: z.string(),
    slug: z.string(),
    city_slug: z.string(),
    phone: z.string().nullable(),
  }),
  address: z.string(),
  services: z.array(z.string()),
});
export type MyBooking = z.infer<typeof myBookingSchema>;

export const blockedDaySchema = z.object({
  id: z.uuid(),
  from: isoDate,
  to: isoDate,
  reason: z.string().nullable(),
});
export type BlockedDay = z.infer<typeof blockedDaySchema>;

export const bookingScopes = ["upcoming", "pending", "past"] as const;
export type BookingScope = (typeof bookingScopes)[number];
