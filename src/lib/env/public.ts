import { z } from "zod";

/**
 * Public (browser-safe) environment variables.
 *
 * Only values that are safe to ship to every visitor belong here. Each
 * variable must be referenced as a literal `process.env.NEXT_PUBLIC_*`
 * expression so Next.js can inline it into the client bundle.
 *
 * Optional integrations are optional here so the marketing site can run
 * before every service is provisioned; code that needs them calls the
 * `require*` helpers, which fail loudly with a setup hint.
 */
const optionalUrl = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .pipe(z.url().optional())
  .optional();

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,
  NEXT_PUBLIC_MAP_STYLE_URL: optionalUrl,
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
  NEXT_PUBLIC_CONTACT_EMAIL: optionalString.pipe(z.email().optional()),
  NEXT_PUBLIC_CONTACT_PHONE: optionalString,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

function parsePublicEnv(): PublicEnv {
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
    NEXT_PUBLIC_CONTACT_PHONE: process.env.NEXT_PUBLIC_CONTACT_PHONE,
  });

  if (!result.success) {
    throw new Error(
      `Invalid public environment variables:\n${z.prettifyError(result.error)}\nSee .env.example.`,
    );
  }

  return result.data;
}

export const publicEnv: PublicEnv = parsePublicEnv();

/** Canonical site origin used for metadata, sitemaps and absolute links. */
export const siteUrl: string =
  publicEnv.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Default map style. OpenFreeMap needs no key and is suitable for development. */
export const mapStyleUrl: string =
  publicEnv.NEXT_PUBLIC_MAP_STYLE_URL ??
  "https://tiles.openfreemap.org/styles/liberty";

export type SupabasePublicConfig = { url: string; publishableKey: string };

export function isSupabaseConfigured(): boolean {
  return Boolean(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL &&
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function requireSupabasePublicConfig(): SupabasePublicConfig {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new MissingConfigError("Supabase", [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ]);
  }

  return { url, publishableKey };
}

/** Thrown when an integration is used before its environment is configured. */
export class MissingConfigError extends Error {
  constructor(
    public readonly integration: string,
    public readonly variables: readonly string[],
  ) {
    super(
      `${integration} is not configured. Set ${variables.join(", ")} (see .env.example and docs/setup).`,
    );
    this.name = "MissingConfigError";
  }
}
