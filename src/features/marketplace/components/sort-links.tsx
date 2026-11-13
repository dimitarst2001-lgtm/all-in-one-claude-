import Link from "next/link";

import { cn } from "@/lib/utils";

import {
  toQueryString,
  type SearchFilters,
  type SortOption,
} from "../search-params";

type SortLinksProps = {
  basePath: string;
  filters: SearchFilters;
  hasUserLocation: boolean;
  hasRatings: boolean;
};

export function SortLinks({
  basePath,
  filters,
  hasUserLocation,
  hasRatings,
}: SortLinksProps) {
  const options: { value: SortOption; label: string }[] = [
    { value: "recommended", label: "Препоръчани" },
  ];
  if (hasUserLocation) options.push({ value: "distance", label: "Най-близо" });
  if (hasRatings) options.push({ value: "rating", label: "Рейтинг" });
  if (options.length < 2) return null;

  const current = filters.sort ?? "recommended";

  return (
    <nav
      aria-label="Подреждане"
      className="flex flex-wrap items-center gap-1 text-sm"
    >
      <span className="mr-1 text-muted-foreground">Подреди:</span>
      {options.map((option) => (
        <Link
          key={option.value}
          href={`${basePath}${toQueryString(filters, { sort: option.value, page: 1 })}`}
          aria-current={current === option.value ? "true" : undefined}
          className={cn(
            "rounded-md px-2.5 py-1 transition-colors",
            current === option.value
              ? "bg-accent font-medium text-accent-foreground"
              : "hover:bg-muted",
          )}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}
