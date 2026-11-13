import { describe, expect, it } from "vitest";

import { parseRoadsideParams } from "./params";

describe("parseRoadsideParams", () => {
  it("rounds coordinates to about 100 m", () => {
    expect(
      parseRoadsideParams({ lat: "43.214178", lng: "27.914733" }),
    ).toMatchObject({ lat: 43.214, lng: 27.915 });
  });

  it("drops a lone coordinate", () => {
    const params = parseRoadsideParams({ lat: "43.2" });
    expect(params.lat).toBeUndefined();
    expect(params.lng).toBeUndefined();
  });

  it("ignores invalid values", () => {
    expect(
      parseRoadsideParams({ service: "Bad Slug!", city: "varna", lat: "999" }),
    ).toEqual({
      service: undefined,
      city: "varna",
      lat: undefined,
      lng: undefined,
    });
  });
});
