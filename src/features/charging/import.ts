import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

import { parseOcmResponse } from "./ocm";
import type { ImportStation } from "./types";

/** A source of charging stations (ADR-010). More operators can be added. */
export interface ChargingDataProvider {
  /** charging_data_sources.code */
  code: string;
  fetchStations(): Promise<{ stations: ImportStation[]; skipped: number }>;
}

const OCM_URL = "https://api.openchargemap.io/v3/poi";

export function openChargeMapProvider(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): ChargingDataProvider {
  return {
    code: "open_charge_map",
    async fetchStations() {
      const url = new URL(OCM_URL);
      url.search = new URLSearchParams({
        output: "json",
        countrycode: "BG",
        maxresults: "10000",
        compact: "false",
        verbose: "false",
      }).toString();
      const response = await fetchImpl(url, {
        headers: { "X-API-Key": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(60_000),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Open Charge Map responded ${response.status}`);
      }
      return parseOcmResponse(await response.json());
    },
  };
}

export type ImportResult =
  | { ok: true; imported: number; removed: number; skipped: number }
  | { ok: false; error: string };

/**
 * Fetches every station from the provider and replaces that source's rows in
 * one database call. Runs with the service-role client (cron only).
 */
export async function runChargingImport(
  provider: ChargingDataProvider,
): Promise<ImportResult> {
  const supabase = getSupabaseAdminClient();
  try {
    const { stations, skipped } = await provider.fetchStations();
    const { data, error } = await supabase.rpc("charging_import", {
      p_source_code: provider.code,
      p_stations: stations,
      p_complete: true,
    });
    if (error) throw new Error(`charging_import: ${error.message}`);
    const result = data as { imported: number; removed: number };
    return { ok: true, ...result, skipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.rpc("charging_import_failed", {
      p_source_code: provider.code,
      p_message: message,
    });
    return { ok: false, error: message };
  }
}
