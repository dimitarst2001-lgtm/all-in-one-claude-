import { publicEnv } from "@/lib/env/public";

const euro = new Intl.NumberFormat("bg-BG", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

export function formatPriceRange(
  fromCents: number | null,
  toCents: number | null,
): string | null {
  if (fromCents === null && toCents === null) return null;
  if (fromCents !== null && toCents !== null && toCents !== fromCents) {
    return `${euro.format(fromCents / 100)} – ${euro.format(toCents / 100)}`;
  }
  const value = fromCents ?? toCents!;
  return fromCents !== null && toCents === null
    ? `от ${euro.format(value / 100)}`
    : euro.format(value / 100);
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} м`;
  return `${km.toLocaleString("bg-BG", { maximumFractionDigits: 1 })} км`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

export const WEEKDAYS = [
  "Понеделник",
  "Вторник",
  "Сряда",
  "Четвъртък",
  "Петък",
  "Събота",
  "Неделя",
] as const;

/** `tel:` href in E.164-ish form (digits and leading +). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function publicMediaUrl(path: string): string | null {
  const base = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/business-media/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function businessPath(city: string, slug: string): string {
  return `/businesses/${city}/${slug}`;
}

export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** Bulgarian locative preposition: "във" before в/ф, otherwise "в". */
export function inCity(name: string): string {
  return /^[ВвФф]/.test(name) ? `във ${name}` : `в ${name}`;
}
