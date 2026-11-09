import "server-only";

import { notFound } from "next/navigation";

import { requireUser } from "@/features/auth/session";

import { getDashboardBusiness } from "./queries";
import { hasRole } from "./types";

/**
 * Loads a business for a dashboard page: redirects anonymous visitors to the
 * login page and returns 404 when the user is not a member (RLS hides it).
 */
export async function loadDashboardBusiness(businessId: string, path: string) {
  const user = await requireUser(path);
  const business = await getDashboardBusiness(businessId);
  if (!business || !business.role) notFound();
  return {
    user,
    business,
    canEdit: hasRole(business.role, "manager"),
  };
}
