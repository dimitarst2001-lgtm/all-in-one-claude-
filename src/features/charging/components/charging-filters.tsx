"use client";

import { CrosshairIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { POWER_OPTIONS, RADIUS_OPTIONS } from "../params";
import { connectorLabels, connectorTypes, type ConnectorType } from "../types";

type Geo =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ready"; lat: number; lng: number }
  | { status: "error"; message: string };

const coarse = (value: number) => Math.round(value * 1000) / 1000;

export function ChargingFilters({
  cities,
  defaults,
}: {
  cities: { slug: string; name: string }[];
  defaults: {
    city?: string;
    lat?: number;
    lng?: number;
    radius?: number;
    connector?: ConnectorType;
    power?: number;
    dc?: boolean;
  };
}) {
  const [geo, setGeo] = useState<Geo>(
    defaults.lat !== undefined && defaults.lng !== undefined
      ? { status: "ready", lat: defaults.lat, lng: defaults.lng }
      : { status: "idle" },
  );

  function locate() {
    if (!("geolocation" in navigator)) {
      setGeo({
        status: "error",
        message: "Браузърът не поддържа определяне на местоположение.",
      });
      return;
    }
    setGeo({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setGeo({
          status: "ready",
          lat: coarse(position.coords.latitude),
          lng: coarse(position.coords.longitude),
        }),
      (error) =>
        setGeo({
          status: "error",
          message:
            error.code === error.PERMISSION_DENIED
              ? "Достъпът до местоположението е отказан. Избери град."
              : "Не успяхме да определим местоположението. Избери град.",
        }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  return (
    <form
      action="/charging"
      method="get"
      aria-label="Филтри за зарядни станции"
      className="grid gap-4 rounded-lg border bg-card p-4 shadow-card sm:p-5"
    >
      <div className="grid gap-2">
        <span className="text-sm font-medium">Къде?</span>
        {geo.status === "ready" ? (
          <div className="flex min-h-10 items-center justify-between gap-2 rounded-md border bg-accent/50 px-3 text-sm">
            <span className="flex items-center gap-2">
              <CrosshairIcon className="size-4 text-brand" aria-hidden="true" />
              Около мен
            </span>
            <button
              type="button"
              onClick={() => setGeo({ status: "idle" })}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-4" aria-hidden="true" />
              Премахни
            </button>
            <input type="hidden" name="lat" value={geo.lat} />
            <input type="hidden" name="lng" value={geo.lng} />
          </div>
        ) : (
          <>
            <Label htmlFor="charging-city" className="sr-only">
              Град
            </Label>
            <NativeSelect
              id="charging-city"
              name="city"
              defaultValue={defaults.city ?? "varna"}
            >
              {cities.map((city) => (
                <option key={city.slug} value={city.slug}>
                  {city.name}
                </option>
              ))}
            </NativeSelect>
            <Button
              type="button"
              variant="outline"
              onClick={locate}
              disabled={geo.status === "locating"}
            >
              {geo.status === "locating" ? (
                <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
              ) : (
                <CrosshairIcon aria-hidden="true" />
              )}
              Около мен
            </Button>
          </>
        )}
        {geo.status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {geo.message}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="charging-radius">Радиус</Label>
        <NativeSelect
          id="charging-radius"
          name="radius"
          defaultValue={defaults.radius?.toString() ?? ""}
        >
          <option value="">По подразбиране</option>
          {RADIUS_OPTIONS.map((radius) => (
            <option key={radius} value={radius}>
              {radius} км
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="charging-connector">Конектор</Label>
        <NativeSelect
          id="charging-connector"
          name="connector"
          defaultValue={defaults.connector ?? ""}
        >
          <option value="">Всички</option>
          {connectorTypes
            .filter((type) => type !== "other")
            .map((type) => (
              <option key={type} value={type}>
                {connectorLabels[type]}
              </option>
            ))}
        </NativeSelect>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="charging-power">Мощност</Label>
        <NativeSelect
          id="charging-power"
          name="power"
          defaultValue={defaults.power?.toString() ?? ""}
        >
          <option value="">Всякаква</option>
          {POWER_OPTIONS.map((power) => (
            <option key={power} value={power}>
              от {power} kW
            </option>
          ))}
        </NativeSelect>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="dc"
          value="1"
          defaultChecked={defaults.dc}
          className="size-4 accent-primary"
        />
        Само бързо зареждане (DC)
      </label>

      <Button type="submit">Покажи станциите</Button>
    </form>
  );
}
