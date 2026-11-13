"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  formValues,
  validationError,
  type FormState,
} from "@/features/auth/form-state";
import { getCurrentUser } from "@/features/auth/session";
import {
  authed,
  fail,
  invalidatePublic,
  NOT_SIGNED_IN,
  SAVED,
  UNAVAILABLE,
} from "@/features/dashboard/action-helpers";
import { dashboardErrorMessage } from "@/features/dashboard/errors";
import { isSupabaseConfigured } from "@/lib/env/public";
import { getClientIp } from "@/lib/security/client-ip";
import { getRateLimiter } from "@/lib/security/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import {
  notifyBookingCancelledByCustomer,
  notifyBookingCreated,
  notifyBookingStatus,
} from "./emails";
import {
  blockedDaysSchema,
  bookingRequestSchema,
  bookingSettingsSchema,
  slotQuerySchema,
  statusChangeSchema,
} from "./schemas";
import { bookingNoticeSchema, slotsSchema, type DaySlots } from "./types";

/**
 * Booking actions. Availability, bay assignment and every permission check
 * live in the database functions; these actions validate input, rate-limit,
 * send notification e-mails and refresh the affected views.
 */

export type SlotsResult =
  { ok: true; day: DaySlots } | { ok: false; message: string };

export async function getSlots(input: {
  businessId: string;
  date: string;
  serviceIds: string[];
}): Promise<SlotsResult> {
  const parsed = slotQuerySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Невалидна заявка." };
  if (!isSupabaseConfigured())
    return { ok: false, message: UNAVAILABLE.message! };

  const ip = await getClientIp();
  const limit = await getRateLimiter().hit(`slots:${ip}`, 120, 600);
  if (!limit.allowed) {
    return { ok: false, message: "Твърде много заявки. Изчакай малко." };
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("available_slots", {
    p_business_id: parsed.data.businessId,
    p_date: parsed.data.date,
    p_service_ids: parsed.data.serviceIds,
  });
  if (error) return { ok: false, message: dashboardErrorMessage(error) };
  if (!data) {
    return {
      ok: false,
      message: "Бизнесът в момента не приема онлайн резервации.",
    };
  }
  return { ok: true, day: slotsSchema.parse(data) };
}

const requestKeys = [
  "businessId",
  "startsAt",
  "name",
  "phone",
  "make",
  "model",
  "plate",
  "notes",
] as const;

export async function createBooking(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formValues(formData, requestKeys);
  const values = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, value ?? ""]),
  );
  const parsed = bookingRequestSchema.safeParse({
    ...raw,
    serviceIds: formData.getAll("serviceIds").map(String),
  });
  if (!parsed.success) return validationError(parsed.error, values);

  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const limit = await getRateLimiter().hit(`booking:${user.id}`, 10, 3600);
  if (!limit.allowed) {
    return {
      status: "error",
      message: "Твърде много резервации за кратко време. Опитай по-късно.",
      values,
    };
  }

  const input = parsed.data;
  const vehicle = Object.fromEntries(
    Object.entries({
      make: input.make,
      model: input.model,
      plate: input.plate?.toUpperCase(),
    }).filter(([, value]) => value),
  );

  let bookingId: string | null = null;
  const result = await authed(async (supabase) => {
    const { data, error } = await supabase.rpc("create_booking", {
      p_business_id: input.businessId,
      p_service_ids: input.serviceIds,
      p_starts_at: input.startsAt,
      p_customer_name: input.name,
      p_customer_phone: input.phone,
      p_vehicle: Object.keys(vehicle).length ? vehicle : null,
      p_notes: input.notes ?? null,
    });
    if (error) return fail(error, values);
    const notice = bookingNoticeSchema.parse(data);
    bookingId = notice.id;
    await notifyBookingCreated(notice);
    return { status: "success" };
  });

  if (bookingId) redirect(`/account/bookings?booked=${bookingId}`);
  return result;
}

export async function cancelMyBooking(
  bookingId: string,
  _prev: FormState,
): Promise<FormState> {
  if (!z.uuid().safeParse(bookingId).success) return NOT_SIGNED_IN;
  return authed(async (supabase) => {
    const { data, error } = await supabase.rpc("cancel_my_booking", {
      p_booking_id: bookingId,
    });
    if (error) return fail(error);
    await notifyBookingCancelledByCustomer(bookingNoticeSchema.parse(data));
    refresh();
    return { status: "success", message: "Резервацията е отменена." };
  });
}

// Business side ------------------------------------------------------------------------

export async function changeBookingStatus(
  businessId: string,
  bookingId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (
    !z.uuid().safeParse(businessId).success ||
    !z.uuid().safeParse(bookingId).success
  ) {
    return NOT_SIGNED_IN;
  }
  const parsed = statusChangeSchema.safeParse(
    formValues(formData, ["status", "reason"]),
  );
  if (!parsed.success) return validationError(parsed.error);

  return authed(async (supabase) => {
    const { data, error } = await supabase.rpc("set_booking_status", {
      p_booking_id: bookingId,
      p_status: parsed.data.status,
      p_reason: parsed.data.reason ?? null,
    });
    if (error) return fail(error);
    const notice = bookingNoticeSchema.parse(data);
    // Completed / no-show are internal bookkeeping; no e-mail for those.
    if (["confirmed", "rejected", "cancelled"].includes(notice.status)) {
      await notifyBookingStatus(notice);
    }
    refresh();
    return SAVED;
  });
}

export async function saveBookingSettings(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!z.uuid().safeParse(businessId).success) return NOT_SIGNED_IN;
  const raw = formValues(formData, [
    "enabled",
    "autoConfirm",
    "slotMinutes",
    "bufferMinutes",
    "leadHours",
    "horizonDays",
  ]);
  const values = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, value ?? ""]),
  );
  const parsed = bookingSettingsSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  return authed(async (supabase) => {
    const input = parsed.data;
    const { data, error } = await supabase
      .from("businesses")
      .update({
        booking_enabled: input.enabled,
        booking_auto_confirm: input.autoConfirm,
        booking_slot_minutes: input.slotMinutes,
        booking_buffer_minutes: input.bufferMinutes,
        booking_lead_hours: input.leadHours,
        booking_horizon_days: input.horizonDays,
      })
      .eq("id", businessId)
      .select("id");
    if (error) return fail(error, values);
    if (!data?.length)
      return { status: "error", message: "Нямаш права за това действие." };
    await invalidatePublic(businessId);
    return SAVED;
  });
}

export async function addBlockedDays(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!z.uuid().safeParse(businessId).success) return NOT_SIGNED_IN;
  const raw = formValues(formData, ["from", "to", "reason"]);
  const values = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, value ?? ""]),
  );
  const parsed = blockedDaysSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  return authed(async (supabase) => {
    const { error } = await supabase.rpc("add_blocked_days", {
      p_business_id: businessId,
      p_from: parsed.data.from,
      p_to: parsed.data.to,
      p_reason: parsed.data.reason ?? null,
    });
    if (error) return fail(error, values);
    refresh();
    return { status: "success", message: "Почивните дни са добавени." };
  });
}

export async function removeBlockedDays(
  businessId: string,
  blockedId: string,
  _prev: FormState,
): Promise<FormState> {
  if (
    !z.uuid().safeParse(businessId).success ||
    !z.uuid().safeParse(blockedId).success
  ) {
    return NOT_SIGNED_IN;
  }
  return authed(async (supabase) => {
    const { data, error } = await supabase
      .from("blocked_periods")
      .delete()
      .eq("id", blockedId)
      .select("id");
    if (error) return fail(error);
    if (!data?.length)
      return { status: "error", message: "Нямаш права за това действие." };
    refresh();
    return { status: "success", message: "Премахнато." };
  });
}
