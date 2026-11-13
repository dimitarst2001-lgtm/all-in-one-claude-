import { z } from "zod";

/*
 * Runtime schemas for the public RPC payloads (supabase/migrations/
 * 20261109110000_public_marketplace.sql). Parsing at the boundary keeps the
 * UI honest if the SQL contract changes.
 */

export const citySchema = z.object({
  slug: z.string(),
  name: z.string(),
  name_en: z.string(),
  launch_order: z.number().nullable(),
  default_radius_km: z.number(),
  lat: z.number(),
  lng: z.number(),
  category_counts: z.record(z.string(), z.number()),
});
export type City = z.infer<typeof citySchema>;

export const categorySchema = z.object({
  slug: z.string(),
  kind: z.enum(["business", "roadside"]),
  name: z.string(),
  name_en: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  sort_order: z.number(),
  services: z.array(
    z.object({ slug: z.string(), name: z.string(), name_en: z.string() }),
  ),
});
export type Category = z.infer<typeof categorySchema>;

export const businessCardSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  city_slug: z.string(),
  city_name: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category_slug: z.string(),
  category_name: z.string(),
  phone: z.string().nullable(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  distance_km: z.number().nullable(),
  open_now: z.boolean().nullable(),
  is_24_7: z.boolean(),
  booking_enabled: z.boolean(),
  is_verified: z.boolean(),
  is_demo: z.boolean(),
  is_featured: z.boolean(),
  rating_avg: z.number().nullable(),
  rating_count: z.number(),
  logo_path: z.string().nullable(),
});
export type BusinessCard = z.infer<typeof businessCardSchema>;

export const searchResultSchema = z.object({
  total: z.number(),
  origin: z.enum(["user", "city_center"]).nullable(),
  items: z.array(businessCardSchema),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

const hoursSchema = z.object({
  weekday: z.number(),
  opens_at: z.string(),
  closes_at: z.string(),
});

export const businessProfileSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  social_links: z.record(z.string(), z.string()).catch({}),
  is_verified: z.boolean(),
  is_demo: z.boolean(),
  booking_enabled: z.boolean(),
  enhanced_profile: z.boolean(),
  updated_at: z.string(),
  city: z.object({ slug: z.string(), name: z.string() }),
  category: z.object({
    slug: z.string(),
    name: z.string(),
    kind: z.enum(["business", "roadside"]),
  }),
  rating: z.object({ avg: z.number(), count: z.number() }).nullable(),
  locations: z.array(
    z.object({
      id: z.uuid(),
      name: z.string().nullable(),
      address: z.string(),
      postal_code: z.string().nullable(),
      city_name: z.string(),
      lat: z.number(),
      lng: z.number(),
      is_primary: z.boolean(),
      is_24_7: z.boolean(),
      hours_verified: z.boolean(),
      open_now: z.boolean().nullable(),
      coverage_radius_km: z.number().nullable(),
      vehicle_restrictions: z.string().nullable(),
      service_areas: z.array(z.string()),
      hours: z.array(hoursSchema),
    }),
  ),
  services: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      description: z.string().nullable(),
      price_from_cents: z.number().nullable(),
      price_to_cents: z.number().nullable(),
      currency: z.string(),
      duration_minutes: z.number().nullable(),
      is_bookable: z.boolean(),
    }),
  ),
  media: z.array(
    z.object({
      kind: z.enum(["logo", "cover", "gallery"]),
      path: z.string(),
      alt: z.string().nullable(),
      width: z.number().nullable(),
      height: z.number().nullable(),
    }),
  ),
});
export type BusinessProfile = z.infer<typeof businessProfileSchema>;

export const businessPathSchema = z.object({
  city: z.string(),
  slug: z.string(),
  updated_at: z.string(),
  is_demo: z.boolean(),
});
export type BusinessPath = z.infer<typeof businessPathSchema>;
