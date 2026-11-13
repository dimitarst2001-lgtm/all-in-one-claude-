"use client";

import { CrosshairIcon, MapPinIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mapStyleUrl } from "@/lib/env/public";

type Point = { lat: number; lng: number };

type LocationPickerProps = {
  /** Initial pin; when absent the map centres on `center` without a pin. */
  value: Point | null;
  center: Point;
  errors?: string[];
};

const round = (value: number) => Math.round(value * 1e6) / 1e6;

/**
 * Lets a business place its pin by clicking or dragging on the map. The
 * coordinates are submitted as `lat`/`lng` fields and can also be typed in,
 * so the form still works when the map cannot load. No geocoding service is
 * used: the business confirms the point itself.
 */
export function LocationPicker({ value, center, errors }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [point, setPoint] = useState<Point | null>(value);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [geoError, setGeoError] = useState<string | null>(null);
  const hasError = Boolean(errors?.length);

  const placeRef = useRef<(next: Point, fly?: boolean) => void>(() => {});

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        await import("maplibre-gl/dist/maplibre-gl.css");
        maplibre.setWorkerUrl(
          `/vendor/maplibre-gl-worker-${maplibre.getVersion()}.mjs`,
        );
        if (disposed || !containerRef.current) return;

        const start = value ?? center;
        const map = new maplibre.Map({
          container: containerRef.current,
          style: mapStyleUrl,
          center: [start.lng, start.lat],
          zoom: value ? 15 : 12,
          attributionControl: { compact: true },
        });
        mapRef.current = map;
        map.addControl(
          new maplibre.NavigationControl({ showCompass: false }),
          "top-right",
        );
        map.on("load", () => !disposed && setMapStatus("ready"));
        map.on("error", (event) => {
          console.error("[map]", event.error);
          if (!disposed && !map.loaded()) setMapStatus("error");
        });

        placeRef.current = (next, fly = false) => {
          if (!markerRef.current) {
            const element = document.createElement("div");
            element.className = "aio-map-marker";
            markerRef.current = new maplibre.Marker({
              element,
              draggable: true,
            })
              .setLngLat([next.lng, next.lat])
              .addTo(map);
            markerRef.current.on("dragend", () => {
              const lngLat = markerRef.current!.getLngLat();
              setPoint({ lat: round(lngLat.lat), lng: round(lngLat.lng) });
            });
          } else {
            markerRef.current.setLngLat([next.lng, next.lat]);
          }
          if (fly) map.flyTo({ center: [next.lng, next.lat], zoom: 16 });
        };

        if (value) placeRef.current(value);
        map.on("click", (event) => {
          const next = {
            lat: round(event.lngLat.lat),
            lng: round(event.lngLat.lng),
          };
          placeRef.current(next);
          setPoint(next);
        });
      } catch (error) {
        console.error("[map]", error);
        if (!disposed) setMapStatus("error");
      }
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is created once; later pin changes go through placeRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateFromInput(key: keyof Point, raw: string) {
    const parsed = Number(raw);
    const next = { ...(point ?? center), [key]: parsed };
    setPoint(next);
    if (Number.isFinite(parsed)) placeRef.current(next, true);
  }

  function useCurrentPosition() {
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError("Браузърът не поддържа определяне на местоположение.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = {
          lat: round(coords.latitude),
          lng: round(coords.longitude),
        };
        setPoint(next);
        placeRef.current(next, true);
      },
      () => setGeoError("Не успяхме да определим местоположението."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-sm font-medium">Точка на картата</legend>
      <p id="location-help" className="text-xs text-muted-foreground">
        Кликни върху картата или премести маркера точно върху входа на обекта.
        Клиентите ще получат упътване до тази точка.
      </p>
      <div className="relative h-72 overflow-hidden rounded-md border bg-muted">
        <div
          ref={containerRef}
          className="h-full w-full"
          role="application"
          aria-label="Карта за избор на местоположение"
          aria-describedby="location-help"
        />
        {mapStatus !== "ready" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted-foreground">
            {mapStatus === "loading"
              ? "Картата се зарежда…"
              : "Картата не можа да се зареди. Въведи координатите ръчно по-долу."}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={useCurrentPosition}
        >
          <CrosshairIcon aria-hidden="true" />
          Използвай текущото ми местоположение
        </Button>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPinIcon className="size-4" aria-hidden="true" />
          {point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
            ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
            : "Няма избрана точка"}
        </p>
      </div>
      {geoError && <p className="text-sm text-destructive">{geoError}</p>}

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Въведи координати ръчно
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="lat-input">Географска ширина</Label>
            <Input
              id="lat-input"
              inputMode="decimal"
              value={point ? String(point.lat) : ""}
              onChange={(event) => updateFromInput("lat", event.target.value)}
              aria-invalid={hasError || undefined}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lng-input">Географска дължина</Label>
            <Input
              id="lng-input"
              inputMode="decimal"
              value={point ? String(point.lng) : ""}
              onChange={(event) => updateFromInput("lng", event.target.value)}
              aria-invalid={hasError || undefined}
            />
          </div>
        </div>
      </details>

      <input type="hidden" name="lat" value={point ? String(point.lat) : ""} />
      <input type="hidden" name="lng" value={point ? String(point.lng) : ""} />
      {hasError && (
        <p className="text-sm text-destructive" role="alert">
          {errors![0]}
        </p>
      )}
    </fieldset>
  );
}
