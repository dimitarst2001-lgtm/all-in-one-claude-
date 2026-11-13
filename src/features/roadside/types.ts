import { z } from "zod";

/** Payload of roadside_providers_for_point (migration 20261115100000). */
export const roadsideProviderSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  city_slug: z.string(),
  city_name: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  is_24_7: z.boolean(),
  open_now: z.boolean().nullable(),
  distance_km: z.number(),
  coverage: z.enum(["area", "radius", "city"]),
  coverage_radius_km: z.number().nullable(),
  is_verified: z.boolean(),
  is_demo: z.boolean(),
  services: z.array(z.string()),
  logo_path: z.string().nullable(),
});
export type RoadsideProvider = z.infer<typeof roadsideProviderSchema>;

export const roadsideResultSchema = z.object({
  total: z.number(),
  items: z.array(roadsideProviderSchema),
});
export type RoadsideResult = z.infer<typeof roadsideResultSchema>;
