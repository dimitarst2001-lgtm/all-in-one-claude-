import { SearchXIcon } from "lucide-react";

import { businessPath } from "../format";
import type { SearchResult } from "../types";
import { BusinessCard } from "./business-card";
import { ResultsLayout } from "./results-layout";

type ResultsSectionProps = {
  result: SearchResult;
  center?: { lat: number; lng: number };
  mapLabel: string;
  emptyTitle?: string;
  emptyHint?: string;
  footer?: React.ReactNode;
};

export function ResultsSection({
  result,
  center,
  mapLabel,
  emptyTitle = "Няма намерени резултати",
  emptyHint = "Опитай с по-голямо разстояние, друг град или без някой от филтрите.",
  footer,
}: ResultsSectionProps) {
  if (result.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card px-6 py-16 text-center">
        <SearchXIcon
          className="size-8 text-muted-foreground"
          aria-hidden="true"
        />
        <h2 className="text-lg font-semibold">{emptyTitle}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  const markers = result.items.map((item) => ({
    id: item.id,
    name: item.name,
    lat: item.lat,
    lng: item.lng,
    href: businessPath(item.city_slug, item.slug),
    subtitle: item.category_name,
  }));

  return (
    <ResultsLayout markers={markers} center={center} mapLabel={mapLabel}>
      <div className="grid gap-4">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {result.items.map((business) => (
            <li key={business.id} className="flex">
              <BusinessCard
                business={business}
                showDistance={result.origin === "user"}
                className="w-full"
              />
            </li>
          ))}
        </ul>
        {footer}
      </div>
    </ResultsLayout>
  );
}
