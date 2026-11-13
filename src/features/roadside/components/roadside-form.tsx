"use client";

import { CrosshairIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

type Option = { slug: string; name: string };

type Geo =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ready"; lat: number; lng: number }
  | { status: "error"; message: string };

// ~100 m: enough to find who covers the spot, not more.
const coarse = (value: number) => Math.round(value * 1000) / 1000;

export function RoadsideForm({
  services,
  cities,
  defaults,
}: {
  services: Option[];
  cities: Option[];
  defaults: {
    service?: string;
    city?: string;
    lat?: number;
    lng?: number;
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
      action="/roadside"
      method="get"
      aria-label="Търсене на пътна помощ"
      className="grid gap-5 rounded-lg border bg-card p-4 shadow-card sm:p-5"
    >
      <div className="grid gap-2">
        <Label htmlFor="roadside-service">Какъв е проблемът?</Label>
        <NativeSelect
          id="roadside-service"
          name="service"
          defaultValue={defaults.service ?? ""}
        >
          <option value="">Всякаква помощ на пътя</option>
          {services.map((service) => (
            <option key={service.slug} value={service.slug}>
              {service.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Къде се намираш?</span>
        {geo.status === "ready" ? (
          <div className="flex min-h-10 items-center justify-between gap-2 rounded-md border bg-accent/50 px-3 text-sm">
            <span className="flex items-center gap-2">
              <CrosshairIcon className="size-4 text-brand" aria-hidden="true" />
              Около текущото ти местоположение
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
          <div className="grid gap-3">
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
              Използвай моето местоположение
            </Button>
            <div className="grid gap-1">
              <Label htmlFor="roadside-city" className="sr-only">
                Град
              </Label>
              <NativeSelect
                id="roadside-city"
                name="city"
                defaultValue={defaults.city ?? ""}
              >
                <option value="">или избери град</option>
                {cities.map((city) => (
                  <option key={city.slug} value={city.slug}>
                    {city.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
        )}
        {geo.status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {geo.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Местоположението се използва само за това търсене, закръглено до около
          100 м, и не се записва.
        </p>
      </div>

      <Button type="submit" size="lg" className="sm:justify-self-start">
        Намери пътна помощ
      </Button>
    </form>
  );
}
