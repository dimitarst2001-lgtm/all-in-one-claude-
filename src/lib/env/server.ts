import "server-only";

import { z } from "zod";

import { MissingConfigError } from "./public";

/**
 * Server-only environment variables. Importing this module from a Client
 * Component fails the build (`server-only`), which keeps secrets such as the
 * Supabase secret key and Stripe keys out of the browser bundle.
 */
const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  SUPABASE_SECRET_KEY: optionalString,

  STRIPE_SECRET_KEY: optionalString.pipe(
    z
      .string()
      .regex(/^sk_(test|live)_/, "must start with sk_test_ or sk_live_")
      .optional(),
  ),
  STRIPE_WEBHOOK_SECRET: optionalString.pipe(
    z
      .string()
      .regex(/^whsec_/, "must start with whsec_")
      .optional(),
  ),

  RESEND_API_KEY: optionalString,
  EMAIL_FROM: optionalString,

  OPEN_CHARGE_MAP_API_KEY: optionalString,

  CRON_SECRET: optionalString.pipe(
    z.string().min(32, "must be at least 32 characters").optional(),
  ),

  UPSTASH_REDIS_REST_URL: optionalString.pipe(z.url().optional()),
  UPSTASH_REDIS_REST_TOKEN: optionalString,

  SENTRY_DSN: optionalString.pipe(z.url().optional()),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function parseServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(
      `Invalid server environment variables:\n${z.prettifyError(result.error)}\nSee .env.example.`,
    );
  }

  return result.data;
}

export const serverEnv: ServerEnv = parseServerEnv();

function requireVars<K extends keyof ServerEnv>(
  integration: string,
  keys: readonly K[],
): { [P in K]: NonNullable<ServerEnv[P]> } {
  const missing = keys.filter((key) => !serverEnv[key]);
  if (missing.length > 0) {
    throw new MissingConfigError(integration, missing as string[]);
  }
  return Object.fromEntries(keys.map((key) => [key, serverEnv[key]])) as {
    [P in K]: NonNullable<ServerEnv[P]>;
  };
}

export const requireSupabaseSecret = () =>
  requireVars("Supabase (service)", ["SUPABASE_SECRET_KEY"]);
export const requireStripe = () =>
  requireVars("Stripe", ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]);
export const requireResend = () =>
  requireVars("Resend", ["RESEND_API_KEY", "EMAIL_FROM"]);
export const requireOpenChargeMap = () =>
  requireVars("Open Charge Map", ["OPEN_CHARGE_MAP_API_KEY"]);
export const requireCronSecret = () => requireVars("Cron", ["CRON_SECRET"]);
