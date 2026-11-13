import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireSupabasePublicConfig } from "@/lib/env/public";
import { requireSupabaseSecret } from "@/lib/env/server";

/**
 * Service-role Supabase client. BYPASSES Row Level Security.
 *
 * Allowed callers only (see SECURITY.md):
 *  - payment provider webhooks
 *  - scheduled import jobs (cron)
 *  - audited administrative operations
 *
 * Never import this from a Client Component; `server-only` enforces that.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  const { url } = requireSupabasePublicConfig();
  const { SUPABASE_SECRET_KEY } = requireSupabaseSecret();

  return createClient(url, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
