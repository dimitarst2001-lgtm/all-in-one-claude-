import { Badge } from "@/components/ui/badge";

import { statusLabels, type BusinessStatus } from "../types";

const variants = {
  draft: "secondary",
  pending_review: "warning",
  approved: "success",
  rejected: "destructive",
  suspended: "destructive",
} as const;

export function StatusBadge({ status }: { status: BusinessStatus }) {
  return <Badge variant={variants[status]}>{statusLabels[status]}</Badge>;
}
