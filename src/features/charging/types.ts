import { z } from "zod";

export const connectorTypes = [
  "ccs2",
  "type2",
  "chademo",
  "ccs1",
  "type1",
  "tesla",
  "schuko",
  "other",
] as const;
export type ConnectorType = (typeof connectorTypes)[number];

export const connectorLabels: Record<ConnectorType, string> = {
  ccs2: "CCS2",
  type2: "Type 2",
  chademo: "CHAdeMO",
  ccs1: "CCS1",
  type1: "Type 1",
  tesla: "Tesla",
  schuko: "Шуко",
  other: "Друг",
};

/** Normalised station as handed to public.charging_import(). */
export type ImportStation = {
  external_id: string;
  name: string;
  operator: string | null;
  address: string | null;
  town: string | null;
  lat: number;
  lng: number;
  usage_type: string | null;
  is_public: boolean | null;
  opening_hours: string | null;
  pricing_text: string | null;
  num_points: number | null;
  status_text: string | null;
  source_url: string | null;
  source_updated_at: string | null;
  connectors: {
    type: ConnectorType;
    label: string | null;
    current: "AC" | "DC" | null;
    power_kw: number | null;
    quantity: number;
  }[];
};

/** Payload of charging_stations_search (migration 20261116100000). */
export const stationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  operator: z.string().nullable(),
  address: z.string().nullable(),
  town: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  distance_km: z.number().nullable(),
  usage_type: z.string().nullable(),
  opening_hours: z.string().nullable(),
  pricing_text: z.string().nullable(),
  num_points: z.number().nullable(),
  max_power_kw: z.number().nullable(),
  has_ac: z.boolean(),
  has_dc: z.boolean(),
  status_text: z.string().nullable(),
  source_url: z.string().nullable(),
  source_updated_at: z.string().nullable(),
  connectors: z.array(
    z.object({
      type: z.enum(connectorTypes),
      label: z.string().nullable(),
      current: z.enum(["AC", "DC"]).nullable(),
      power_kw: z.number().nullable(),
      quantity: z.number(),
    }),
  ),
});
export type Station = z.infer<typeof stationSchema>;

export const stationSearchSchema = z.object({
  total: z.number(),
  radius_km: z.number().nullable(),
  items: z.array(stationSchema),
  sources: z.array(
    z.object({
      name: z.string(),
      website: z.string().nullable(),
      attribution: z.string(),
      license: z.string(),
      last_import_at: z.string().nullable(),
      last_import_status: z.string().nullable(),
    }),
  ),
});
export type StationSearch = z.infer<typeof stationSearchSchema>;
