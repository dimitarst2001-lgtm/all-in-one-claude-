import { describe, expect, it } from "vitest";

import {
  formatDistance,
  formatDuration,
  formatPriceRange,
  inCity,
  telHref,
} from "./format";

describe("format", () => {
  it("formats price ranges in euro", () => {
    expect(formatPriceRange(null, null)).toBeNull();
    expect(formatPriceRange(4000, null)).toMatch(/^от 40,00\s€$/);
    expect(formatPriceRange(4000, 6000)).toMatch(/40,00\s€ – 60,00\s€/);
    expect(formatPriceRange(1500, 1500)).toMatch(/^15,00\s€$/);
  });

  it("formats distances", () => {
    expect(formatDistance(0.45)).toBe("450 м");
    expect(formatDistance(3.24)).toBe("3,2 км");
  });

  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45 мин");
    expect(formatDuration(120)).toBe("2 ч");
    expect(formatDuration(90)).toBe("1 ч 30 мин");
  });

  it("builds tel links", () => {
    expect(telHref("+359 52 000 101")).toBe("tel:+35952000101");
  });

  it("uses the right Bulgarian preposition", () => {
    expect(inCity("Варна")).toBe("във Варна");
    expect(inCity("София")).toBe("в София");
    expect(inCity("Велико Търново")).toBe("във Велико Търново");
  });
});
