"use client";

import { ListIcon, MapIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { BusinessMap, type MapMarker } from "./business-map";

const DESKTOP_QUERY = "(min-width: 64rem)";

function subscribe(callback: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

type ResultsLayoutProps = {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  mapLabel: string;
  children: React.ReactNode;
};

/**
 * Desktop: list and map side by side. Mobile: list first with a toggle to
 * the map. The map is only mounted when it is actually visible.
 */
export function ResultsLayout({
  markers,
  center,
  mapLabel,
  children,
}: ResultsLayoutProps) {
  const [view, setView] = useState<"list" | "map">("list");
  const isDesktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
  const showMap = markers.length > 0 && (isDesktop || view === "map");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-start">
      {markers.length > 0 && (
        <div className="flex justify-end lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setView(view === "list" ? "map" : "list")}
            aria-pressed={view === "map"}
          >
            {view === "list" ? (
              <MapIcon aria-hidden="true" />
            ) : (
              <ListIcon aria-hidden="true" />
            )}
            {view === "list" ? "Покажи на картата" : "Покажи списъка"}
          </Button>
        </div>
      )}

      <div className={cn(view === "map" && "hidden lg:block")}>{children}</div>

      {showMap && (
        <div className="lg:sticky lg:top-20">
          <BusinessMap
            markers={markers}
            center={center}
            label={mapLabel}
            className="h-[70vh] min-h-80 lg:h-[calc(100vh-7rem)]"
          />
        </div>
      )}
    </div>
  );
}
