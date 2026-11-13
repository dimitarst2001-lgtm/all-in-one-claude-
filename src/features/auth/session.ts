import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { isSupabaseConfigured } from "@/lib/env/public";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type PlatformRole = "moderator" | "super_admin";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  platformRoles: PlatformRole[];
};

/**
 * Data-access-layer entry point for "who is signed in". Verifies the JWT via
 * getClaims() (never trusts an unverified cookie session) and loads the
 * profile and platform roles under RLS. Returns null for anonymous users.
 *
 * Reads cookies: call it inside a <Suspense> boundary or a dynamic route.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Always request-time, even when Supabase is not configured, so pages that
  // depend on the user are never prerendered with an anonymous result.
  await connection();
  if (!isSupabaseConfigured()) return null;

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const userId = data.claims.sub;
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, is_suspended")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  if (profile?.is_suspended) return null;

  return {
    id: userId,
    email: typeof data.claims.email === "string" ? data.claims.email : "",
    fullName: profile?.full_name ?? null,
    platformRoles: (roles ?? []).map((row) => row.role as PlatformRole),
  };
}

/** Redirects to login (preserving the destination) when nobody is signed in. */
export async function requireUser(nextPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}
