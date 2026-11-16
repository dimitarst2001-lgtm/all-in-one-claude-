import { z } from "zod";

import { connectorTypes } from "./types";

export const POWER_OPTIONS = [11, 22, 50, 150] as const;
export const RADIUS_OPTIONS = [5, 10, 25, 50] as const;

const single = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) =>
      Array.isArray(value) ? value[0] : value === "" ? undefined : value,
    schema.optional(),
  );

const oneOf = <T extends readonly number[]>(options: T) =>
  z.coerce
    .number()
    .refine((value): value is T[number] =>
      (options as readonly number[]).includes(value),
    );

const schema = z.object({
  city: single(
    z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .max(80),
  ).catch(undefined),
  lat: single(z.coerce.number().min(-90).max(90)).catch(undefined),
  lng: single(z.coerce.number().min(-180).max(180)).catch(undefined),
  radius: single(oneOf(RADIUS_OPTIONS)).catch(undefined),
  connector: single(z.enum(connectorTypes)).catch(undefined),
  power: single(oneOf(POWER_OPTIONS)).catch(undefined),
  dc: single(
    z
      .union([z.literal("1"), z.literal("on"), z.literal("true")])
      .transform(() => true),
  ).catch(undefined),
});

export type ChargingParams = z.infer<typeof schema>;

/** Coordinates count only as a pair and are rounded to ~100 m. */
export function parseChargingParams(
  raw: Record<string, string | string[] | undefined>,
): ChargingParams {
  const parsed = schema.parse(raw);
  if (parsed.lat === undefined || parsed.lng === undefined) {
    parsed.lat = undefined;
    parsed.lng = undefined;
  } else {
    parsed.lat = Math.round(parsed.lat * 1000) / 1000;
    parsed.lng = Math.round(parsed.lng * 1000) / 1000;
  }
  return parsed;
}
