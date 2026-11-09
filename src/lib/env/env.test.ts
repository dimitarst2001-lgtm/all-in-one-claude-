import { afterEach, describe, expect, it, vi } from "vitest";

async function loadPublicEnv() {
  vi.resetModules();
  return import("./public");
}

async function loadServerEnv() {
  vi.resetModules();
  return import("./server");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public env", () => {
  it("treats Supabase as unconfigured when variables are empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const env = await loadPublicEnv();

    expect(env.isSupabaseConfigured()).toBe(false);
    expect(() => env.requireSupabasePublicConfig()).toThrow(
      env.MissingConfigError,
    );
  });

  it("returns Supabase config when both variables are set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    const env = await loadPublicEnv();

    expect(env.requireSupabasePublicConfig()).toEqual({
      url: "https://abc.supabase.co",
      publishableKey: "sb_publishable_test",
    });
  });

  it("rejects a malformed site URL at startup", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not a url");
    await expect(loadPublicEnv()).rejects.toThrow(
      /Invalid public environment variables/,
    );
  });

  it("falls back to localhost when no site URL is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const env = await loadPublicEnv();
    expect(env.siteUrl).toBe("http://localhost:3000");
  });
});

describe("server env", () => {
  it("rejects a Stripe secret with the wrong prefix", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "pk_test_123");
    await expect(loadServerEnv()).rejects.toThrow(/STRIPE_SECRET_KEY/);
  });

  it("rejects a short cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "short");
    await expect(loadServerEnv()).rejects.toThrow(/CRON_SECRET/);
  });

  it("reports every missing variable for an integration", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const env = await loadServerEnv();

    expect(() => env.requireStripe()).toThrow(
      /STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET/,
    );
  });
});
