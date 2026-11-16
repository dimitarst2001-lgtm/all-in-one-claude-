import { z } from "zod";

import type { ConnectorType, ImportStation } from "./types";

/*
 * Open Charge Map POI (https://openchargemap.org/site/develop/api), fetched
 * with compact=false so reference titles are included. Only the fields we use
 * are validated; everything else is ignored.
 */
const connectionSchema = z.object({
  ConnectionTypeID: z.number().nullish(),
  ConnectionType: z.object({ Title: z.string().nullish() }).nullish(),
  CurrentTypeID: z.number().nullish(),
  PowerKW: z.number().nullish(),
  Quantity: z.number().nullish(),
});

export const ocmPoiSchema = z.object({
  ID: z.number(),
  AddressInfo: z.object({
    Title: z.string().nullish(),
    AddressLine1: z.string().nullish(),
    Town: z.string().nullish(),
    Latitude: z.number(),
    Longitude: z.number(),
    AccessComments: z.string().nullish(),
  }),
  OperatorInfo: z.object({ Title: z.string().nullish() }).nullish(),
  UsageType: z
    .object({
      Title: z.string().nullish(),
      IsPayAtLocation: z.boolean().nullish(),
      IsMembershipRequired: z.boolean().nullish(),
    })
    .nullish(),
  UsageTypeID: z.number().nullish(),
  UsageCost: z.string().nullish(),
  StatusType: z
    .object({
      Title: z.string().nullish(),
      IsOperational: z.boolean().nullish(),
    })
    .nullish(),
  NumberOfPoints: z.number().nullish(),
  DateLastStatusUpdate: z.string().nullish(),
  DateLastVerified: z.string().nullish(),
  Connections: z.array(connectionSchema).nullish(),
});
export type OcmPoi = z.infer<typeof ocmPoiSchema>;

// OCM connection type ids (reference data "ConnectionTypes").
const CONNECTOR_BY_ID: Record<number, ConnectorType> = {
  33: "ccs2",
  32: "ccs1",
  25: "type2",
  1036: "type2",
  1: "type1",
  2: "chademo",
  27: "tesla",
  30: "tesla",
  8: "tesla",
  28: "schuko",
};

function connectorType(id?: number | null, title?: string | null) {
  if (id && CONNECTOR_BY_ID[id]) return CONNECTOR_BY_ID[id];
  const text = (title ?? "").toLowerCase();
  if (text.includes("ccs") && text.includes("type 1")) return "ccs1";
  if (text.includes("ccs")) return "ccs2";
  if (text.includes("chademo")) return "chademo";
  if (text.includes("tesla")) return "tesla";
  if (text.includes("type 2") || text.includes("mennekes")) return "type2";
  if (text.includes("type 1") || text.includes("j1772")) return "type1";
  if (text.includes("schuko")) return "schuko";
  return "other";
}

// OCM current types: 10 = AC single phase, 20 = AC three phase, 30 = DC.
function currentType(id?: number | null): "AC" | "DC" | null {
  if (id === 30) return "DC";
  if (id === 10 || id === 20) return "AC";
  return null;
}

// UsageTypeID 1 public, 4 public membership, 5 public pay at location, 7 public notice required.
const PUBLIC_USAGE = new Set([1, 4, 5, 7]);
const PRIVATE_USAGE = new Set([2, 3, 6]);

export function normaliseOcmPoi(poi: OcmPoi): ImportStation {
  const address = poi.AddressInfo;
  const usageId = poi.UsageTypeID ?? null;
  return {
    external_id: String(poi.ID),
    name: address.Title?.trim() || "Зарядна станция",
    operator: poi.OperatorInfo?.Title ?? null,
    address: address.AddressLine1 ?? null,
    town: address.Town ?? null,
    lat: address.Latitude,
    lng: address.Longitude,
    usage_type: poi.UsageType?.Title ?? null,
    is_public:
      usageId === null
        ? null
        : PUBLIC_USAGE.has(usageId)
          ? true
          : PRIVATE_USAGE.has(usageId)
            ? false
            : null,
    opening_hours: address.AccessComments ?? null,
    pricing_text: poi.UsageCost ?? null,
    num_points: poi.NumberOfPoints ?? null,
    status_text: poi.StatusType?.Title ?? null,
    source_url: `https://openchargemap.org/site/poi/details/${poi.ID}`,
    source_updated_at: poi.DateLastStatusUpdate ?? poi.DateLastVerified ?? null,
    connectors: (poi.Connections ?? []).map((connection) => ({
      type: connectorType(
        connection.ConnectionTypeID,
        connection.ConnectionType?.Title,
      ),
      label: connection.ConnectionType?.Title ?? null,
      current: currentType(connection.CurrentTypeID),
      power_kw: connection.PowerKW ?? null,
      quantity: connection.Quantity ?? 1,
    })),
  };
}

/** Parses an OCM response, skipping malformed entries instead of failing. */
export function parseOcmResponse(data: unknown): {
  stations: ImportStation[];
  skipped: number;
} {
  if (!Array.isArray(data))
    throw new Error("Open Charge Map: expected an array");
  const stations: ImportStation[] = [];
  let skipped = 0;
  for (const item of data) {
    const parsed = ocmPoiSchema.safeParse(item);
    if (parsed.success) stations.push(normaliseOcmPoi(parsed.data));
    else skipped += 1;
  }
  return { stations, skipped };
}
