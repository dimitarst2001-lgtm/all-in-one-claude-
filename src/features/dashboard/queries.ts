import "server-only";

import { cache } from "react";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/env/public";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import {
  dashboardBusinessSchema,
  dashboardMediaSchema,
  invitationPreviewSchema,
  myBusinessSchema,
  teamSchema,
  type BusinessTeam,
  type DashboardBusiness,
  type DashboardMedia,
  type InvitationPreview,
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

export const getBusinessMedia = cache(
  async (businessId: string): Promise<DashboardMedia[]> => {
    if (!isSupabaseConfigured() || !z.uuid().safeParse(businessId).success) {
      return [];
    }
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("business_media")
      .select("id, kind, storage_path, alt_text, width, height, sort_order")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("sort_order")
      .order("created_at");
    if (error) throw new Error(`[dashboard] business_media: ${error.message}`);
    return z.array(dashboardMediaSchema).parse(data ?? []);
  },
);

export const getBusinessTeam = cache(
  async (businessId: string): Promise<BusinessTeam | null> => {
    if (!isSupabaseConfigured() || !z.uuid().safeParse(businessId).success) {
      return null;
    }
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.rpc("business_team", {
      p_business_id: businessId,
    });
    if (error) throw new Error(`[dashboard] business_team: ${error.message}`);
    return data ? teamSchema.parse(data) : null;
  },
);

export async function getInvitationPreview(
  token: string,
): Promise<InvitationPreview | null> {
  if (!isSupabaseConfigured() || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    return null;
  }
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("invitation_preview", {
    p_token: token,
  });
  if (error)
    throw new Error(`[dashboard] invitation_preview: ${error.message}`);
  return data ? invitationPreviewSchema.parse(data) : null;
}
