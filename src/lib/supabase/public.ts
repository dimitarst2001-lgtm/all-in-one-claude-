import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  isSupabaseConfigured,
  requireSupabasePublicConfig,
} from "@/lib/env/public";

let publicClient: SupabaseClient | undefined;

/**
 * Cookie-less anonymous client for public, cacheable reads (marketplace
 * pages inside `'use cache'`). Acts as the `anon` role, so RLS limits it to
 * publicly visible data. Returns null when Supabase is not configured.
 */
export function getSupabasePublicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!publicClient) {
    const { url, publishableKey } = requireSupabasePublicConfig();
    publicClient = createClient(url, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return publicClient;
}
