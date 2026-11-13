import {
  BadgeCheckIcon,
  CalendarCheckIcon,
  ClockIcon,
  FlaskConicalIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

/** Shown only when the answer is reliable (open_now is null otherwise). */
export function OpenStatusBadge({
  openNow,
  is247,
}: {
  openNow: boolean | null;
  is247: boolean;
}) {
  if (is247) {
    return (
      <Badge variant="success">
        <ClockIcon aria-hidden="true" />
        24/7
      </Badge>
    );
  }
  if (openNow === null) return null;
  return openNow ? (
    <Badge variant="success">
      <ClockIcon aria-hidden="true" />
      Отворено сега
    </Badge>
  ) : (
    <Badge variant="secondary" className="text-[#0f1a2a]">
      <ClockIcon aria-hidden="true" />
      Затворено сега
    </Badge>
  );
}

export function DemoBadge() {
  return (
    <Badge
      variant="warning"
      title="Примерна обява, създадена за демонстрация. Не е реален бизнес."
    >
      <FlaskConicalIcon aria-hidden="true" />
      Демо обява
    </Badge>
  );
}

export function VerifiedBadge() {
  return (
    <Badge title="Данните на бизнеса са проверени от екипа на платформата.">
      <BadgeCheckIcon aria-hidden="true" />
      Проверен
    </Badge>
  );
}

export function BookingBadge() {
  return (
    <Badge variant="outline" className="text-[#0f1a2a]">
      <CalendarCheckIcon aria-hidden="true" />
      Онлайн резервация
    </Badge>
  );
}
