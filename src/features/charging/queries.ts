import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { getSupabasePublicClient } from "@/lib/supabase/public";

import type { ChargingParams } from "./params";
import { stationSearchSchema, type StationSearch } from "./types";

export const chargingTag = "charging-stations";

const EMPTY: StationSearch = {
  total: 0,
  radius_km: null,
  items: [],
  sources: [],
};

/** Reads imported stations only; pages never call the provider directly. */
export async function searchStations(
  params: ChargingParams,
): Promise<StationSearch> {
  "use cache";
  cacheTag(chargingTag);
  cacheLife("hours");

  const supabase = getSupabasePublicClient();
  if (!supabase) return EMPTY;
  const { data, error } = await supabase.rpc("charging_stations_search", {
    p_lat: params.lat ?? null,
    p_lng: params.lng ?? null,
    p_city_slug: params.lat === undefined ? (params.city ?? null) : null,
    p_radius_km: params.radius ?? null,
    p_connector: params.connector ?? null,
    p_min_power_kw: params.power ?? null,
    p_dc_only: params.dc ?? false,
    p_limit: 150,
  });
  if (error) {
    if (error.code === "22023") return EMPTY;
    throw new Error(`[charging] search failed: ${error.message}`);
  }
  return data ? stationSearchSchema.parse(data) : EMPTY;
}
