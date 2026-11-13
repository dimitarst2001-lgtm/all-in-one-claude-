import type { RoadsideProvider } from "./types";

export function coverageLabel(provider: RoadsideProvider): string {
  switch (provider.coverage) {
    case "city":
      return "Обслужва целия град";
    case "area":
      return "В зоната им на обслужване";
    case "radius":
      return provider.coverage_radius_km
        ? `Обслужва до ${provider.coverage_radius_km.toLocaleString("bg-BG")} км от базата`
        : "В радиуса им на обслужване";
  }
}
