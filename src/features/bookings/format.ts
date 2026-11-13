/** Date helpers for bookings. Times are shown in the business's timezone. */

export const DEFAULT_TIMEZONE = "Europe/Sofia";

export function formatBookingDate(iso: string, timeZone = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat("bg-BG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(new Date(iso));
}

export function formatBookingTime(iso: string, timeZone = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat("bg-BG", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(iso));
}

/** "петък, 20 ноември, 10:00–11:00" */
export function formatBookingRange(
  startsAt: string,
  endsAt: string,
  timeZone = DEFAULT_TIMEZONE,
) {
  return `${formatBookingDate(startsAt, timeZone)}, ${formatBookingTime(startsAt, timeZone)}–${formatBookingTime(endsAt, timeZone)}`;
}

/** Adds days to a YYYY-MM-DD date without timezone drift. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Short label for a date chip, e.g. "пт 20.11". */
export function dayChipLabel(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = new Intl.DateTimeFormat("bg-BG", {
    weekday: "short",
    timeZone: "UTC",
  }).format(date);
  return `${weekday} ${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
}

/**
 * Request time for server components that pass "now" down to client
 * components, so client renders stay pure and match the server.
 */
export function requestTime(): number {
  return Date.now();
}
