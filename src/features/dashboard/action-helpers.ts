import "server-only";

import { refresh, updateTag } from "next/cache";

import type { FormState } from "@/features/auth/form-state";
import { getCurrentUser } from "@/features/auth/session";
import { marketplaceTags } from "@/features/marketplace/queries";
import { MissingConfigError } from "@/lib/env/public";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import { dashboardErrorMessage } from "./errors";
import { getDashboardBusiness } from "./queries";

/** Shared plumbing for the dashboard server actions (not an action module). */

export type Supabase = Awaited<ReturnType<typeof getSupabaseServerClient>>;

export const NOT_SIGNED_IN: FormState = {
  status: "error",
  message: "Сесията ти е изтекла. Влез отново.",
};
export const UNAVAILABLE: FormState = {
  status: "error",
  message: "Услугата временно не е налична. Опитай отново по-късно.",
};
export const SAVED: FormState = {
  status: "success",
  message: "Промените са запазени.",
};

export async function authed(
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
export async function invalidatePublic(businessId: string) {
  // Slug and city never change through the dashboard, so the request-cached
  // read is accurate enough to find the public cache entry.
  const business = await getDashboardBusiness(businessId);
  updateTag(marketplaceTags.businesses);
  if (business) {
    updateTag(marketplaceTags.business(business.city.slug, business.slug));
  }
  refresh();
}

export function fail(
  error: Parameters<typeof dashboardErrorMessage>[0],
  values?: Record<string, string>,
): FormState {
  return { status: "error", message: dashboardErrorMessage(error), values };
}
