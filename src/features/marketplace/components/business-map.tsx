"use client";

import { MapIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { mapStyleUrl } from "@/lib/env/public";
import { cn } from "@/lib/utils";

export type MapMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  href?: string;
  subtitle?: string;
};

type BusinessMapProps = {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  /** Accessible description of what the map shows. */
  label: string;
};

/**
 * Interactive MapLibre map. maplibre-gl (~200 kB) is loaded on demand, only
 * when the map component mounts, so pages without a visible map never pay
 * for it. The list next to the map carries the same information, so the
 * map is an enhancement rather than the only way to reach a business.
 */
export function BusinessMap({
  markers,
  center,
  zoom = 12,
  className,
  label,
}: BusinessMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    let disposed = false;
    let map: import("maplibre-gl").Map | undefined;

    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        await import("maplibre-gl/dist/maplibre-gl.css");
        // The worker is copied to /public/vendor on install (scripts/copy-vendor-assets.mjs).
        maplibre.setWorkerUrl(
          `/vendor/maplibre-gl-worker-${maplibre.getVersion()}.mjs`,
        );
        if (disposed || !containerRef.current) return;

        const fallbackCenter =
          center ??
          (markers[0]
            ? { lat: markers[0].lat, lng: markers[0].lng }
            : { lat: 43.2141, lng: 27.9147 });

        map = new maplibre.Map({
          container: containerRef.current,
          style: mapStyleUrl,
          center: [fallbackCenter.lng, fallbackCenter.lat],
          zoom,
          attributionControl: { compact: true },
          cooperativeGestures: true,
        });
        map.addControl(
          new maplibre.NavigationControl({ showCompass: false }),
          "top-right",
        );
        map.on("load", () => !disposed && setStatus("ready"));
        map.on("error", (event) => {
          console.error("[map]", event.error);
          if (!disposed && !map?.loaded()) setStatus("error");
        });

        const bounds = new maplibre.LngLatBounds();
        for (const marker of markers) {
          const element = document.createElement("div");
          element.className = "aio-map-marker";
          element.setAttribute("aria-hidden", "true");

          const popup = new maplibre.Popup({ offset: 18, closeButton: false });
          const content = document.createElement("div");
          content.className = "aio-map-popup";
          const title = document.createElement(marker.href ? "a" : "strong");
          title.textContent = marker.name;
          if (marker.href && title instanceof HTMLAnchorElement)
            title.href = marker.href;
          content.append(title);
          if (marker.subtitle) {
            const subtitle = document.createElement("span");
            subtitle.textContent = marker.subtitle;
            content.append(subtitle);
          }
          popup.setDOMContent(content);

          new maplibre.Marker({ element })
            .setLngLat([marker.lng, marker.lat])
            .setPopup(popup)
            .addTo(map);
          bounds.extend([marker.lng, marker.lat]);
        }

        if (markers.length > 1 && !center) {
          map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
        }
      } catch (error) {
        console.error("[map] failed to initialise", error);
        if (!disposed) setStatus("error");
      }
    })();

    return () => {
      disposed = true;
      map?.remove();
    };
  }, [markers, center, zoom]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-muted",
        className,
      )}
      role="region"
      aria-label={label}
    >
      {/* MapLibre sets position: relative on its container, so size it with h/w rather than inset. */}
      <div ref={containerRef} className="h-full w-full" />
      {status !== "ready" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
          <MapIcon
            className={cn("size-6", status === "loading" && "animate-pulse")}
            aria-hidden="true"
          />
          {status === "loading"
            ? "Картата се зарежда…"
            : "Картата не може да се зареди в момента. Списъкът съдържа същите места."}
        </div>
      )}
    </div>
  );
}
