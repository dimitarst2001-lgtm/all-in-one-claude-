"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  formValues,
  validationError,
  type FormState,
} from "@/features/auth/form-state";
import { getCurrentUser } from "@/features/auth/session";
import { marketplaceTags } from "@/features/marketplace/queries";
import { MissingConfigError } from "@/lib/env/public";
import { getClientIp } from "@/lib/security/client-ip";
import { getRateLimiter } from "@/lib/security/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import { dashboardErrorMessage } from "./errors";
import { getDashboardBusiness } from "./queries";
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

type Supabase = Awaited<ReturnType<typeof getSupabaseServerClient>>;

const NOT_SIGNED_IN: FormState = {
  status: "error",
  message: "Сесията ти е изтекла. Влез отново.",
};
const UNAVAILABLE: FormState = {
  status: "error",
  message: "Услугата временно не е налична. Опитай отново по-късно.",
};
const SAVED: FormState = {
  status: "success",
  message: "Промените са запазени.",
};

const uuid = z.uuid();

async function authed(
  run: (supabase: Supabase) => Promise<FormState>,
): Promise<FormState> {
  try {
    const user = await getCurrentUser();
    if (!user) return NOT_SIGNED_IN;
    return await run(await getSupabaseServerClient());
  } catch (error) {
    if (error instanceof MissingConfigError) return UNAVAILABLE;
    throw error;
  }
}

/** Public listing data may have changed: drop the cached marketplace pages. */
async function invalidatePublic(businessId: string) {
  // Slug and city never change through the dashboard, so the request-cached
  // read is accurate enough to find the public cache entry.
  const business = await getDashboardBusiness(businessId);
  updateTag(marketplaceTags.businesses);
  if (business) {
    updateTag(marketplaceTags.business(business.city.slug, business.slug));
  }
  refresh();
}

function fail(
  error: Parameters<typeof dashboardErrorMessage>[0],
  values?: Record<string, string>,
): FormState {
  return { status: "error", message: dashboardErrorMessage(error), values };
}

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
  if (!uuid.safeParse(businessId).success) return NOT_SIGNED_IN;
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
    !uuid.safeParse(businessId).success ||
    !uuid.safeParse(locationId).success
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

export async function saveHours(
  businessId: string,
  locationId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (
    !uuid.safeParse(businessId).success ||
    !uuid.safeParse(locationId).success
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
  if (!uuid.safeParse(businessId).success) return NOT_SIGNED_IN;
  const raw = formValues(formData, [
    "id",
    "serviceTypeId",
    "name",
    "description",
    "priceFrom",
    "priceTo",
    "durationMinutes",
    "isActive",
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
    !uuid.safeParse(businessId).success ||
    !uuid.safeParse(serviceId).success
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
  if (!uuid.safeParse(businessId).success) return NOT_SIGNED_IN;
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
