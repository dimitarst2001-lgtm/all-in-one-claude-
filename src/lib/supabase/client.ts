"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabasePublicConfig } from "@/lib/env/public";

let browserClient: SupabaseClient | undefined;

/**
 * Browser Supabase client. Uses the publishable key; every query is subject
 * to Row Level Security for the signed-in user.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    const { url, publishableKey } = requireSupabasePublicConfig();
    browserClient = createBrowserClient(url, publishableKey);
  }
  return browserClient;
}
