"use client";

import type { BusinessEventType } from "../events";
import { trackBusinessEvent } from "../events";

type TrackedLinkProps = React.ComponentProps<"a"> & {
  businessId: string;
  event: BusinessEventType;
};

/**
 * Plain link that records an anonymous contact-click counter for the
 * business dashboard. Tracking never blocks or alters navigation.
 */
export function TrackedLink({
  businessId,
  event,
  onClick,
  ...props
}: TrackedLinkProps) {
  return (
    <a
      {...props}
      onClick={(clickEvent) => {
        onClick?.(clickEvent);
        void trackBusinessEvent(businessId, event).catch(() => {});
      }}
    />
  );
}
