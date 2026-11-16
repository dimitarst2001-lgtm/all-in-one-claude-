import { describe, expect, it } from "vitest";

import { parseOcmResponse } from "./ocm";
import { parseChargingParams } from "./params";

const poi = {
  ID: 12345,
  AddressInfo: {
    Title: "Mall Varna",
    AddressLine1: "bul. Vladislav Varnenchik 186",
    Town: "Varna",
    Latitude: 43.2203,
    Longitude: 27.8933,
  },
  OperatorInfo: { Title: "Eldrive" },
  UsageTypeID: 5,
  UsageType: { Title: "Public - Pay At Location" },
  StatusType: { Title: "Operational", IsOperational: true },
  NumberOfPoints: 2,
  DateLastStatusUpdate: "2026-10-01T10:00:00Z",
  Connections: [
    {
      ConnectionTypeID: 33,
      ConnectionType: { Title: "CCS (Type 2)" },
      CurrentTypeID: 30,
      PowerKW: 150,
      Quantity: 2,
    },
    {
      ConnectionTypeID: 1036,
      ConnectionType: { Title: "Type 2 (Tethered Connector) " },
      CurrentTypeID: 20,
      PowerKW: 22,
    },
    { ConnectionTypeID: 9999, ConnectionType: { Title: "CHAdeMO" } },
  ],
};

describe("parseOcmResponse", () => {
  it("normalises a POI", () => {
    const { stations, skipped } = parseOcmResponse([poi]);
    expect(skipped).toBe(0);
    expect(stations[0]).toMatchObject({
      external_id: "12345",
      name: "Mall Varna",
      operator: "Eldrive",
      is_public: true,
      status_text: "Operational",
      source_url: "https://openchargemap.org/site/poi/details/12345",
    });
    expect(stations[0].connectors).toEqual([
      {
        type: "ccs2",
        label: "CCS (Type 2)",
        current: "DC",
        power_kw: 150,
        quantity: 2,
      },
      {
        type: "type2",
        label: "Type 2 (Tethered Connector) ",
        current: "AC",
        power_kw: 22,
        quantity: 1,
      },
      {
        type: "chademo",
        label: "CHAdeMO",
        current: null,
        power_kw: null,
        quantity: 1,
      },
    ]);
  });

  it("skips malformed entries", () => {
    const { stations, skipped } = parseOcmResponse([
      poi,
      { ID: 1 },
      { ID: 2, AddressInfo: { Latitude: "x", Longitude: 1 } },
    ]);
    expect(stations).toHaveLength(1);
    expect(skipped).toBe(2);
  });

  it("rejects a non-array response", () => {
    expect(() => parseOcmResponse({ error: "bad key" })).toThrow();
  });
});

describe("parseChargingParams", () => {
  it("keeps only supported filters", () => {
    expect(
      parseChargingParams({
        connector: "ccs2",
        power: "50",
        radius: "7",
        dc: "1",
      }),
    ).toMatchObject({
      connector: "ccs2",
      power: 50,
      radius: undefined,
      dc: true,
    });
  });

  it("rounds coordinates", () => {
    expect(
      parseChargingParams({ lat: "43.21419", lng: "27.91473" }),
    ).toMatchObject({
      lat: 43.214,
      lng: 27.915,
    });
  });
});
