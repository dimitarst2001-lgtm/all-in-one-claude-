"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  formValues,
  validationError,
  type FormState,
} from "@/features/auth/form-state";
import { getClientIp } from "@/lib/security/client-ip";
import { getRateLimiter } from "@/lib/security/rate-limit";

import {
  authed,
  fail,
  invalidatePublic,
  NOT_SIGNED_IN,
  SAVED,
} from "./action-helpers";
import {
  createBusinessSchema,
  hoursSchema,
  locationSchema,
  profileSchema,
  serviceSchema,
} from "./schemas";

/**
 * Business dashboard mutations. Authorisation is enforced by the database
 * (RLS, column grants, SECURITY INVOKER functions); these actions validate
 * input, translate errors and invalidate public caches.
 */

// Onboarding --------------------------------------------------------------------

const createKeys = [
  "name",
  "city",
  "category",
  "addressLine",
  "postalCode",
  "lat",
  "lng",
  "phone",
  "email",
  "website",
] as const;

export async function createBusiness(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formValues(formData, createKeys);
  const values = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, value ?? ""]),
  );
  const parsed = createBusinessSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  const ip = await getClientIp();
  const limit = await getRateLimiter().hit(`createBusiness:${ip}`, 10, 3600);
  if (!limit.allowed) {
    return {
      status: "error",
      message: "Твърде много опити. Опитай отново по-късно.",
      values,
    };
  }

  let createdId: string | null = null;
  const result = await authed(async (supabase) => {
    const input = parsed.data;
    const { data, error } = await supabase.rpc("create_business", {
      p_name: input.name,
      p_city_slug: input.city,
      p_category_slug: input.category,
      p_address_line: input.addressLine,
      p_lat: input.lat,
      p_lng: input.lng,
      p_phone: input.phone,
      p_email: input.email,
      p_website: input.website,
      p_postal_code: input.postalCode,
    });
    if (error) return fail(error, values);
    createdId = z.object({ id: z.uuid() }).parse(data).id;
    return SAVED;
  });

  if (createdId) redirect(`/dashboard/${createdId}?created=1`);
  return result;
}

// Profile --------------------------------------------------------------------------

export async function updateProfile(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!z.uuid().safeParse(businessId).success) return NOT_SIGNED_IN;
  const raw = formValues(formData, [
    "name",
    "description",
    "phone",
    "email",
    "website",
  ]);
  const values = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, value ?? ""]),
  );
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  return authed(async (supabase) => {
    const { data, error } = await supabase
      .from("businesses")
      .update(parsed.data)
      .eq("id", businessId)
      .select("id");
    if (error) return fail(error, values);
    if (!data?.length)
      return { status: "error", message: "Нямаш права за това действие." };
    await invalidatePublic(businessId);
    return SAVED;
  });
}

// Location ----------------------------------------------------------------------------

export async function updateLocation(
  businessId: string,
  locationId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (
    !z.uuid().safeParse(businessId).success ||
    !z.uuid().safeParse(locationId).success
  ) {
    return NOT_SIGNED_IN;
  }
  const raw = formValues(formData, [
    "addressLine",
    "postalCode",
    "lat",
    "lng",
    "is247",
    "coverageRadiusKm",
    "capacity",
    "vehicleRestrictions",
  ]);
  const values = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, value ?? ""]),
  );
  const parsed = locationSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  return authed(async (supabase) => {
    const input = parsed.data;
    const { error } = await supabase.rpc("update_business_location", {
      p_location_id: locationId,
      p_address_line: input.addressLine,
      p_lat: input.lat,
      p_lng: input.lng,
      p_postal_code: input.postalCode,
      p_is_24_7: input.is247,
      p_coverage_radius_km: input.coverageRadiusKm,
      p_capacity: input.capacity,
      p_vehicle_restrictions: input.vehicleRestrictions,
    });
    if (error) return fail(error, values);
    await invalidatePublic(businessId);
    return SAVED;
  });
}

const citySlug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(80);

export async function saveCoverageCities(
  businessId: string,
  locationId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (
    !z.uuid().safeParse(businessId).success ||
    !z.uuid().safeParse(locationId).success
  ) {
    return NOT_SIGNED_IN;
  }
  const parsed = z
    .array(citySlug)
    .max(20)
    .safeParse(formData.getAll("cities").map(String));
  if (!parsed.success) {
    return { status: "error", message: "Невалиден избор на градове." };
  }

  return authed(async (supabase) => {
    const { error } = await supabase.rpc("set_location_coverage_cities", {
      p_location_id: locationId,
      p_city_slugs: [...new Set(parsed.data)],
    });
    if (error) return fail(error);
    await invalidatePublic(businessId);
    return SAVED;
  });
}

export async function saveHours(
  businessId: string,
  locationId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (
    !z.uuid().safeParse(businessId).success ||
    !z.uuid().safeParse(locationId).success
  ) {
    return NOT_SIGNED_IN;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("hours") ?? "[]"));
  } catch {
    payload = null;
  }
  const parsed = hoursSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Провери работното време.",
    };
  }

  return authed(async (supabase) => {
    const { error } = await supabase.rpc("set_location_hours", {
      p_location_id: locationId,
      p_hours: parsed.data,
    });
    if (error) return fail(error);
    await invalidatePublic(businessId);
    return { status: "success", message: "Работното време е запазено." };
  });
}

// Services ------------------------------------------------------------------------------

export async function saveService(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!z.uuid().safeParse(businessId).success) return NOT_SIGNED_IN;
  const raw = formValues(formData, [
    "id",
    "serviceTypeId",
    "name",
    "description",
    "priceFrom",
    "priceTo",
    "durationMinutes",
    "isActive",
    "isBookable",
  ]);
  const values = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, value ?? ""]),
  );
  const parsed = serviceSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  return authed(async (supabase) => {
    const input = parsed.data;
    const row = {
      service_id: input.serviceTypeId ?? null,
      name: input.name,
      description: input.description,
      price_from_cents: input.priceFrom,
      price_to_cents: input.priceTo,
      duration_minutes: input.durationMinutes,
      is_active: input.isActive,
      is_bookable: input.isBookable,
    };
    const query = input.id
      ? supabase
          .from("business_services")
          .update(row)
          .eq("id", input.id)
          .eq("business_id", businessId)
          .is("deleted_at", null)
      : supabase
          .from("business_services")
          .insert({ ...row, business_id: businessId });
    const { data, error } = await query.select("id");
    if (error) return fail(error, values);
    if (!data?.length)
      return { status: "error", message: "Нямаш права за това действие." };
    await invalidatePublic(businessId);
    return {
      status: "success",
      message: input.id ? "Услугата е обновена." : "Услугата е добавена.",
    };
  });
}

export async function deleteService(
  businessId: string,
  serviceId: string,
  _prev: FormState,
): Promise<FormState> {
  if (
    !z.uuid().safeParse(businessId).success ||
    !z.uuid().safeParse(serviceId).success
  ) {
    return NOT_SIGNED_IN;
  }
  return authed(async (supabase) => {
    const { data, error } = await supabase
      .from("business_services")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", serviceId)
      .eq("business_id", businessId)
      .select("id");
    if (error) return fail(error);
    if (!data?.length)
      return { status: "error", message: "Нямаш права за това действие." };
    await invalidatePublic(businessId);
    return { status: "success", message: "Услугата е премахната." };
  });
}

// Review --------------------------------------------------------------------------------

export async function submitForReview(
  businessId: string,
  _prev: FormState,
): Promise<FormState> {
  if (!z.uuid().safeParse(businessId).success) return NOT_SIGNED_IN;
  return authed(async (supabase) => {
    const { error } = await supabase.rpc("submit_business_for_review", {
      p_business_id: businessId,
    });
    if (error) return fail(error);
    refresh();
    return {
      status: "success",
      message:
        "Профилът е изпратен за преглед. Статусът ще се промени тук след решението на модератор.",
    };
  });
}
