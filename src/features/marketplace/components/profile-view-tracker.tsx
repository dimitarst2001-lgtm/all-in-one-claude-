"use client";

import { useEffect } from "react";

import { trackBusinessEvent } from "../events";

/** Counts one anonymous profile view per page load (no personal data). */
export function ProfileViewTracker({ businessId }: { businessId: string }) {
  useEffect(() => {
    void trackBusinessEvent(businessId, "profile_view").catch(() => {});
  }, [businessId]);
  return null;
}
