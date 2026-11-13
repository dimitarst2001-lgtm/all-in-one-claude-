import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { marketplaceTags } from "@/features/marketplace/queries";
import { getSupabasePublicClient } from "@/lib/supabase/public";

import { roadsideResultSchema, type RoadsideResult } from "./types";

const EMPTY: RoadsideResult = { total: 0, items: [] };

/** Providers whose declared coverage contains the point (RLS applies). */
export async function getRoadsideProviders(
  lat: number,
  lng: number,
  service: string | null,
): Promise<RoadsideResult> {
  "use cache";
  cacheTag(marketplaceTags.businesses);
  cacheLife("minutes");

  const supabase = getSupabasePublicClient();
  if (!supabase) return EMPTY;
  const { data, error } = await supabase.rpc("roadside_providers_for_point", {
    p_lat: lat,
    p_lng: lng,
    p_service_slug: service,
  });
  if (error) {
    // Unknown service slugs come from hand-edited URLs: show no results.
    if (error.code === "22023") return EMPTY;
    throw new Error(`[roadside] lookup failed: ${error.message}`);
  }
  return data ? roadsideResultSchema.parse(data) : EMPTY;
}
