import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabasePublicConfig } from "@/lib/env/public";

/**
 * Request-scoped Supabase client for Server Components, Server Actions and
 * Route Handlers. Acts as the signed-in user (RLS applies).
 *
 * Reads cookies, so callers render at request time and must sit inside a
 * <Suspense> boundary when used from a page.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient> {
  const { url, publishableKey } = requireSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The session is refreshed by src/proxy.ts instead.
        }
      },
    },
  });
}
