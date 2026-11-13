import "server-only";

import { cache } from "react";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/env/public";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import {
  dashboardBusinessSchema,
  myBusinessSchema,
  type DashboardBusiness,
  type MyBusiness,
} from "./types";

/**
 * Dashboard data access. Runs as the signed-in user, so RLS decides what is
 * visible; a business the user is not a member of simply returns null.
 * Request-time only (reads cookies) and deduplicated per request.
 */

export const getMyBusinesses = cache(async (): Promise<MyBusiness[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_businesses");
  if (error) throw new Error(`[dashboard] my_businesses: ${error.message}`);
  return z.array(myBusinessSchema).parse(data ?? []);
});

export const getDashboardBusiness = cache(
  async (businessId: string): Promise<DashboardBusiness | null> => {
    if (!isSupabaseConfigured() || !z.uuid().safeParse(businessId).success) {
      return null;
    }
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.rpc("dashboard_business", {
      p_business_id: businessId,
    });
    if (error) {
      throw new Error(`[dashboard] dashboard_business: ${error.message}`);
    }
    return data ? dashboardBusinessSchema.parse(data) : null;
  },
);
