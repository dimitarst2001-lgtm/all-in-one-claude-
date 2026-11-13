import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

import { getSupabasePublicClient } from "@/lib/supabase/public";

import { PAGE_SIZE, type SearchFilters } from "./search-params";
import {
  businessPathSchema,
  businessProfileSchema,
  categorySchema,
  citySchema,
  searchResultSchema,
  type BusinessPath,
  type BusinessProfile,
  type Category,
  type City,
  type SearchResult,
} from "./types";

/**
 * Public marketplace data access. Every function reads through the anon
 * client (RLS applies), validates the payload, and is cached with tags so
 * admin/business edits can invalidate it (revalidateTag).
 *
 * When Supabase is not configured the functions return empty data, so the
 * marketing site still renders in development.
 */

export const marketplaceTags = {
  cities: "cities",
  categories: "categories",
  businesses: "businesses",
  business: (city: string, slug: string) => `business:${city}:${slug}`,
} as const;

async function callRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    throw new Error(`[marketplace] ${fn} failed: ${error.message}`);
  }
  if (data === null) return null;
  return schema.parse(data);
}

export async function getCities(): Promise<City[]> {
  "use cache";
  cacheTag(marketplaceTags.cities, marketplaceTags.businesses);
  cacheLife("hours");
  return (await callRpc("public_cities", {}, z.array(citySchema))) ?? [];
}

export async function getCity(slug: string): Promise<City | null> {
  const cities = await getCities();
  return cities.find((city) => city.slug === slug) ?? null;
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheTag(marketplaceTags.categories);
  cacheLife("hours");
  return (
    (await callRpc("public_categories", {}, z.array(categorySchema))) ?? []
  );
}

export async function getCategory(slug: string): Promise<Category | null> {
  const categories = await getCategories();
  return categories.find((category) => category.slug === slug) ?? null;
}

const EMPTY_RESULT: SearchResult = { total: 0, origin: null, items: [] };

export async function searchBusinesses(
  filters: SearchFilters,
  pageSize = PAGE_SIZE,
): Promise<SearchResult> {
  "use cache";
  cacheTag(marketplaceTags.businesses);
  cacheLife("minutes");

  const page = filters.page ?? 1;
  const result = await callRpc(
    "search_businesses",
    {
      p_city_slug: filters.city ?? null,
      p_category_slug: filters.category ?? null,
      p_service_slug: filters.service ?? null,
      p_query: filters.q ?? null,
      p_lat: filters.lat ?? null,
      p_lng: filters.lng ?? null,
      p_radius_km: filters.radius ?? null,
      p_open_now: filters.open ?? false,
      p_booking_only: filters.booking ?? false,
      p_sort: filters.sort ?? "recommended",
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    },
    searchResultSchema,
  );
  return result ?? EMPTY_RESULT;
}

export async function getBusinessProfile(
  city: string,
  slug: string,
): Promise<BusinessProfile | null> {
  "use cache";
  cacheTag(marketplaceTags.businesses, marketplaceTags.business(city, slug));
  cacheLife("minutes");
  return callRpc(
    "get_business_profile",
    { p_city_slug: city, p_slug: slug },
    businessProfileSchema,
  );
}

export async function getBusinessPaths(): Promise<BusinessPath[]> {
  "use cache";
  cacheTag(marketplaceTags.businesses);
  cacheLife("hours");
  return (
    (await callRpc("public_business_paths", {}, z.array(businessPathSchema))) ??
    []
  );
}
