import { z } from "zod";

export const RADIUS_OPTIONS = [5, 10, 25, 50, 100] as const;
export const SORT_OPTIONS = ["recommended", "distance", "rating"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];
export const PAGE_SIZE = 12;

const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(80);

const flag = z
  .union([z.literal("1"), z.literal("on"), z.literal("true")])
  .transform(() => true);

/** Accepts a single value; repeated query keys use the first one. */
const single = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) =>
      Array.isArray(value) ? value[0] : value === "" ? undefined : value,
    schema.optional(),
  );

export const searchParamsSchema = z.object({
  city: single(slug).catch(undefined),
  category: single(slug).catch(undefined),
  service: single(slug).catch(undefined),
  q: single(z.string().trim().max(80)).catch(undefined),
  lat: single(z.coerce.number().min(-90).max(90)).catch(undefined),
  lng: single(z.coerce.number().min(-180).max(180)).catch(undefined),
  radius: single(
    z.coerce
      .number()
      .refine((value): value is (typeof RADIUS_OPTIONS)[number] =>
        (RADIUS_OPTIONS as readonly number[]).includes(value),
      ),
  ).catch(undefined),
  open: single(flag).catch(undefined),
  booking: single(flag).catch(undefined),
  sort: single(z.enum(SORT_OPTIONS)).catch(undefined),
  page: single(z.coerce.number().int().min(1).max(200)).catch(undefined),
});

export type SearchFilters = z.infer<typeof searchParamsSchema>;

export function parseSearchParams(
  raw: Record<string, string | string[] | undefined>,
): SearchFilters {
  const parsed = searchParamsSchema.parse(raw);
  // Coordinates only count as a pair.
  if (parsed.lat === undefined || parsed.lng === undefined) {
    parsed.lat = undefined;
    parsed.lng = undefined;
  }
  return parsed;
}

/** Serialises filters back to a query string (omitting defaults). */
export function toQueryString(
  filters: SearchFilters,
  overrides: Partial<SearchFilters> = {},
): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (
      value === undefined ||
      value === null ||
      value === false ||
      value === ""
    )
      continue;
    if (key === "page" && value === 1) continue;
    if (key === "sort" && value === "recommended") continue;
    params.set(key, value === true ? "1" : String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
