"use client";

import {
  CrosshairIcon,
  LoaderCircleIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

import { RADIUS_OPTIONS, type SearchFilters } from "../search-params";

type Option = { slug: string; name: string };
type CategoryOption = Option & { services: Option[] };

type SearchFormProps = {
  cities: Option[];
  categories: CategoryOption[];
  defaults?: SearchFilters;
  variant?: "hero" | "panel";
};

type GeoState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ready"; lat: number; lng: number }
  | { status: "error"; message: string };

/** Rounds to ~100 m. We never need (or keep) a more precise position. */
const coarse = (value: number) => Math.round(value * 1000) / 1000;

export function SearchForm({
  cities,
  categories,
  defaults = {},
  variant = "panel",
}: SearchFormProps) {
  const [category, setCategory] = useState(defaults.category ?? "");
  const [geo, setGeo] = useState<GeoState>(
    defaults.lat !== undefined && defaults.lng !== undefined
      ? { status: "ready", lat: defaults.lat, lng: defaults.lng }
      : { status: "idle" },
  );
  const [radius, setRadius] = useState(
    defaults.radius ? String(defaults.radius) : "",
  );

  const services =
    categories.find((item) => item.slug === category)?.services ?? [];
  const isHero = variant === "hero";

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
      (position) => {
        setGeo({
          status: "ready",
          lat: coarse(position.coords.latitude),
          lng: coarse(position.coords.longitude),
        });
        if (!radius) setRadius("10");
      },
      (error) => {
        setGeo({
          status: "error",
          message:
            error.code === error.PERMISSION_DENIED
              ? "Достъпът до местоположението е отказан. Избери град вместо това."
              : "Не успяхме да определим местоположението ти. Избери град.",
        });
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  const labelClass = cn(isHero && "text-navy-foreground");

  return (
    <form
      action="/search"
      method="get"
      role="search"
      aria-label="Търсене на автоуслуги"
      className={cn(
        "grid gap-4",
        isHero
          ? "rounded-lg border border-white/10 bg-navy-800/80 p-4 sm:p-5"
          : "rounded-lg border bg-card p-4 shadow-card",
      )}
    >
      <div
        className={cn("grid gap-4", isHero && "md:grid-cols-[1.4fr_1fr_1fr]")}
      >
        <div className="grid gap-2">
          <Label htmlFor={`${variant}-q`} className={labelClass}>
            Какво търсиш?
          </Label>
          <Input
            id={`${variant}-q`}
            name="q"
            type="search"
            placeholder="Име на сервиз или услуга"
            defaultValue={defaults.q}
            maxLength={80}
            autoComplete="off"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${variant}-city`} className={labelClass}>
            Град
          </Label>
          <NativeSelect
            id={`${variant}-city`}
            name="city"
            defaultValue={defaults.city ?? (isHero ? "varna" : "")}
          >
            <option value="">Всички градове</option>
            {cities.map((city) => (
              <option key={city.slug} value={city.slug}>
                {city.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${variant}-category`} className={labelClass}>
            Категория
          </Label>
          <NativeSelect
            id={`${variant}-category`}
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Всички услуги</option>
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {!isHero && services.length > 0 && (
        <div className="grid gap-2">
          <Label htmlFor="panel-service">Услуга</Label>
          <NativeSelect
            id="panel-service"
            name="service"
            defaultValue={defaults.service ?? ""}
            key={category}
          >
            <option value="">Всички</option>
            {services.map((service) => (
              <option key={service.slug} value={service.slug}>
                {service.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      <div
        className={cn(
          "grid gap-3",
          isHero ? "sm:grid-cols-[auto_1fr] sm:items-end" : "",
        )}
      >
        <div className="grid gap-2">
          <span className={cn("text-sm font-medium", labelClass)}>
            Местоположение
          </span>
          {geo.status === "ready" ? (
            <div
              className={cn(
                "flex h-10 items-center justify-between gap-2 rounded-md border px-3 text-sm",
                isHero
                  ? "border-white/15 text-navy-foreground"
                  : "bg-accent/50",
              )}
            >
              <span className="flex items-center gap-2">
                <CrosshairIcon
                  className="size-4 text-brand"
                  aria-hidden="true"
                />
                Около мен
              </span>
              <button
                type="button"
                onClick={() => setGeo({ status: "idle" })}
                className="cursor-pointer rounded p-1 hover:bg-black/10"
                aria-label="Спри да използваш местоположението ми"
              >
                <XIcon className="size-4" aria-hidden="true" />
              </button>
              <input type="hidden" name="lat" value={geo.lat} />
              <input type="hidden" name="lng" value={geo.lng} />
            </div>
          ) : (
            <Button
              type="button"
              variant={isHero ? "outline-dark" : "outline"}
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
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${variant}-radius`} className={labelClass}>
            Разстояние
          </Label>
          <NativeSelect
            id={`${variant}-radius`}
            name="radius"
            value={radius}
            onChange={(event) => setRadius(event.target.value)}
          >
            <option value="">В рамките на града</option>
            {RADIUS_OPTIONS.map((km) => (
              <option key={km} value={km}>
                До {km} км
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {geo.status === "error" && (
        <p
          role="alert"
          className={cn(
            "text-sm",
            isHero ? "text-warning" : "text-destructive",
          )}
        >
          {geo.message}
        </p>
      )}

      {!isHero && (
        <fieldset className="grid gap-2.5">
          <legend className="mb-1 text-sm font-medium">Филтри</legend>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="open"
              value="1"
              defaultChecked={defaults.open}
              className="size-4 accent-[#1565C0]"
            />
            Отворено сега
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="booking"
              value="1"
              defaultChecked={defaults.booking}
              className="size-4 accent-[#1565C0]"
            />
            С онлайн резервация
          </label>
        </fieldset>
      )}

      {defaults.sort && !isHero && (
        <input type="hidden" name="sort" value={defaults.sort} />
      )}

      <Button
        type="submit"
        variant={isHero ? "brand" : "default"}
        size={isHero ? "lg" : "default"}
        className="w-full"
      >
        <SearchIcon aria-hidden="true" />
        Търси
      </Button>
      <p
        className={cn(
          "text-xs",
          isHero ? "text-navy-muted" : "text-muted-foreground",
        )}
      >
        Местоположението се закръгля до около 100 м и се използва само за това
        търсене.
      </p>
    </form>
  );
}
