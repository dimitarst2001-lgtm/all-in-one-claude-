import "server-only";

import { cache } from "react";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/env/public";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import {
  blockedDaySchema,
  bookingOptionsSchema,
  businessBookingSchema,
  myBookingSchema,
  type BlockedDay,
  type BookingOptions,
  type BookingScope,
  type BusinessBooking,
  type MyBooking,
} from "./types";

/** Booking reads. All run under RLS as the current visitor. */

export const getBookingOptions = cache(
  async (citySlug: string, slug: string): Promise<BookingOptions | null> => {
    if (!isSupabaseConfigured()) return null;
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.rpc("booking_options", {
      p_city_slug: citySlug,
      p_slug: slug,
    });
    if (error) throw new Error(`[bookings] booking_options: ${error.message}`);
    return data ? bookingOptionsSchema.parse(data) : null;
  },
);

export async function getBusinessBookings(
  businessId: string,
  scope: BookingScope,
): Promise<BusinessBooking[]> {
  if (!isSupabaseConfigured() || !z.uuid().safeParse(businessId).success) {
    return [];
  }
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("business_bookings", {
    p_business_id: businessId,
    p_scope: scope,
  });
  if (error) throw new Error(`[bookings] business_bookings: ${error.message}`);
  return z.array(businessBookingSchema).parse(data ?? []);
}

export async function getBlockedDays(
  businessId: string,
): Promise<BlockedDay[]> {
  if (!isSupabaseConfigured() || !z.uuid().safeParse(businessId).success) {
    return [];
  }
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("business_blocked_days", {
    p_business_id: businessId,
  });
  if (error) throw new Error(`[bookings] blocked days: ${error.message}`);
  return z.array(blockedDaySchema).parse(data ?? []);
}

export async function getMyBookings(): Promise<MyBooking[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_bookings");
  if (error) throw new Error(`[bookings] my_bookings: ${error.message}`);
  return z.array(myBookingSchema).parse(data ?? []);
}

const settingsSchema = z.object({
  booking_enabled: z.boolean(),
  booking_auto_confirm: z.boolean(),
  booking_slot_minutes: z.number().int(),
  booking_buffer_minutes: z.number().int(),
  booking_lead_hours: z.number().int(),
  booking_horizon_days: z.number().int(),
});
export type BookingSettings = z.infer<typeof settingsSchema>;

export async function getBookingSettings(
  businessId: string,
): Promise<BookingSettings | null> {
  if (!isSupabaseConfigured() || !z.uuid().safeParse(businessId).success) {
    return null;
  }
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("businesses")
    .select(
      "booking_enabled, booking_auto_confirm, booking_slot_minutes, booking_buffer_minutes, booking_lead_hours, booking_horizon_days",
    )
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw new Error(`[bookings] settings: ${error.message}`);
  return data ? settingsSchema.parse(data) : null;
}
