import { z } from "zod";

const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(80);

const single = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) =>
      Array.isArray(value) ? value[0] : value === "" ? undefined : value,
    schema.optional(),
  );

const roadsideParamsSchema = z.object({
  service: single(slug).catch(undefined),
  city: single(slug).catch(undefined),
  lat: single(z.coerce.number().min(-90).max(90)).catch(undefined),
  lng: single(z.coerce.number().min(-180).max(180)).catch(undefined),
});

export type RoadsideParams = z.infer<typeof roadsideParamsSchema>;

/**
 * Coordinates are rounded to ~100 m before use, the same precision the search
 * form sends, so the exact position never travels further than needed.
 */
export function parseRoadsideParams(
  raw: Record<string, string | string[] | undefined>,
): RoadsideParams {
  const parsed = roadsideParamsSchema.parse(raw);
  if (parsed.lat === undefined || parsed.lng === undefined) {
    parsed.lat = undefined;
    parsed.lng = undefined;
  } else {
    parsed.lat = Math.round(parsed.lat * 1000) / 1000;
    parsed.lng = Math.round(parsed.lng * 1000) / 1000;
  }
  return parsed;
}
