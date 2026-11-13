import { describe, expect, it } from "vitest";

import { parseSearchParams, toQueryString } from "./search-params";

describe("parseSearchParams", () => {
  it("parses a full query", () => {
    expect(
      parseSearchParams({
        city: "varna",
        category: "auto-repair",
        q: " гуми ",
        lat: "43.2",
        lng: "27.9",
        radius: "10",
        open: "1",
        booking: "on",
        sort: "distance",
        page: "2",
      }),
    ).toEqual({
      city: "varna",
      category: "auto-repair",
      service: undefined,
      q: "гуми",
      lat: 43.2,
      lng: 27.9,
      radius: 10,
      open: true,
      booking: true,
      sort: "distance",
      page: 2,
    });
  });

  it("drops invalid values instead of failing", () => {
    const parsed = parseSearchParams({
      city: "../etc",
      radius: "7",
      sort: "price",
      page: "-3",
      lat: "999",
      lng: "27",
      category: "<script>",
    });
    expect(parsed.city).toBeUndefined();
    expect(parsed.radius).toBeUndefined();
    expect(parsed.sort).toBeUndefined();
    expect(parsed.page).toBeUndefined();
    expect(parsed.lat).toBeUndefined();
    expect(parsed.lng).toBeUndefined();
    expect(parsed.category).toBeUndefined();
  });

  it("only keeps coordinates as a pair", () => {
    expect(parseSearchParams({ lat: "43.2" }).lat).toBeUndefined();
  });

  it("uses the first value of repeated keys", () => {
    expect(parseSearchParams({ city: ["sofia", "varna"] }).city).toBe("sofia");
  });
});

describe("toQueryString", () => {
  it("omits defaults and applies overrides", () => {
    const filters = parseSearchParams({
      city: "varna",
      sort: "recommended",
      page: "3",
    });
    expect(toQueryString(filters, { page: 1 })).toBe("?city=varna");
    expect(toQueryString(filters, { page: 4 })).toBe("?city=varna&page=4");
  });
});
