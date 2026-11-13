"use server";

import { z } from "zod";

import { getClientIp } from "@/lib/security/client-ip";
import { getRateLimiter } from "@/lib/security/rate-limit";
import { getSupabasePublicClient } from "@/lib/supabase/public";

const eventTypes = [
  "profile_view",
  "phone_click",
  "website_click",
  "email_click",
  "directions_click",
  "booking_cta",
] as const;
export type BusinessEventType = (typeof eventTypes)[number];

const inputSchema = z.object({
  businessId: z.uuid(),
  type: z.enum(eventTypes),
});

/**
 * Records an anonymous analytics counter (no IP, user id or location is
 * stored). Rate limited per IP and business to keep counts meaningful.
 */
export async function trackBusinessEvent(
  businessId: string,
  type: BusinessEventType,
): Promise<void> {
  const parsed = inputSchema.safeParse({ businessId, type });
  if (!parsed.success) return;

  const ip = await getClientIp();
  const { allowed } = await getRateLimiter().hit(
    `event:${ip}:${businessId}:${type}`,
    5,
    3600,
  );
  if (!allowed) return;

  const supabase = getSupabasePublicClient();
  if (!supabase) return;
  const { error } = await supabase.rpc("track_business_event", {
    p_business_id: businessId,
    p_type: type,
  });
  if (error) console.error("[events] track failed", error.message);
}
