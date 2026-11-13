import { timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";

import { chargingTag } from "@/features/charging/queries";
import {
  openChargeMapProvider,
  runChargingImport,
} from "@/features/charging/import";
import { MissingConfigError } from "@/lib/env/public";
import {
  requireCronSecret,
  requireOpenChargeMap,
  requireSupabaseSecret,
} from "@/lib/env/server";

export const maxDuration = 300;

function authorised(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Nightly EV charging import (vercel.json cron). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; anything else gets 401.
 */
export async function GET(request: Request) {
  let config;
  try {
    const { CRON_SECRET } = requireCronSecret();
    if (!authorised(request.headers.get("authorization"), CRON_SECRET)) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    requireSupabaseSecret();
    config = requireOpenChargeMap();
  } catch (error) {
    if (error instanceof MissingConfigError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }

  const result = await runChargingImport(
    openChargeMapProvider(config.OPEN_CHARGE_MAP_API_KEY),
  );
  if (result.ok) revalidateTag(chargingTag, "max");
  else console.error("[charging-import]", result.error);
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
