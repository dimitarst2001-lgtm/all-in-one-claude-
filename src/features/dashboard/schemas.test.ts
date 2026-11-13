import { describe, expect, it } from "vitest";

import {
  createBusinessSchema,
  hoursSchema,
  inviteSchema,
  phoneSchema,
  profileSchema,
  serviceSchema,
} from "./schemas";
import { hasRole } from "./types";

describe("phoneSchema", () => {
  it("normalises Bulgarian numbers", () => {
    expect(phoneSchema.parse("0888 123 456")).toBe("+359888123456");
    expect(phoneSchema.parse("+359 52 600 100")).toBe("+35952600100");
    expect(phoneSchema.parse("00359888123456")).toBe("+359888123456");
  });

  it("rejects other input", () => {
    expect(phoneSchema.safeParse("12345").success).toBe(false);
    expect(phoneSchema.safeParse("+44 20 7946 0958").success).toBe(false);
  });
});

describe("createBusinessSchema", () => {
  const base = {
    name: "Сервиз Тест",
    city: "varna",
    category: "auto-repair",
    addressLine: "ул. Тестова 1",
    lat: "43.21",
    lng: "27.91",
    phone: "0888123456",
  };

  it("accepts a minimal business and normalises optional fields", () => {
    const parsed = createBusinessSchema.parse({
      ...base,
      website: "example.bg",
    });
    expect(parsed.website).toBe("https://example.bg");
    expect(parsed.email).toBeNull();
    expect(parsed.postalCode).toBeNull();
    expect(parsed.lat).toBeCloseTo(43.21);
  });

  it("requires a map point", () => {
    expect(createBusinessSchema.safeParse({ ...base, lat: "" }).success).toBe(
      false,
    );
  });

  it("rejects javascript: websites", () => {
    expect(
      createBusinessSchema.safeParse({
        ...base,
        website: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
});

describe("profileSchema", () => {
  it("allows clearing optional fields", () => {
    const parsed = profileSchema.parse({
      name: "Сервиз",
      description: "",
      phone: "",
      email: "",
      website: "",
    });
    expect(parsed).toMatchObject({
      description: null,
      phone: null,
      email: null,
      website: null,
    });
  });
});

describe("hoursSchema", () => {
  it("accepts split days", () => {
    expect(
      hoursSchema.safeParse([
        { weekday: 1, opens_at: "08:00", closes_at: "12:00" },
        { weekday: 1, opens_at: "13:00", closes_at: "18:00" },
      ]).success,
    ).toBe(true);
  });

  it("rejects overlaps and inverted intervals", () => {
    expect(
      hoursSchema.safeParse([
        { weekday: 2, opens_at: "08:00", closes_at: "12:00" },
        { weekday: 2, opens_at: "11:00", closes_at: "18:00" },
      ]).success,
    ).toBe(false);
    expect(
      hoursSchema.safeParse([
        { weekday: 3, opens_at: "18:00", closes_at: "08:00" },
      ]).success,
    ).toBe(false);
  });
});

describe("serviceSchema", () => {
  it("converts euro prices to cents", () => {
    const parsed = serviceSchema.parse({
      name: "Смяна на масло",
      priceFrom: "45,50",
      priceTo: "60",
      durationMinutes: "45",
    });
    expect(parsed.priceFrom).toBe(4550);
    expect(parsed.priceTo).toBe(6000);
    expect(parsed.durationMinutes).toBe(45);
  });

  it("rejects a price range that goes down", () => {
    expect(
      serviceSchema.safeParse({
        name: "Услуга",
        priceFrom: "50",
        priceTo: "10",
      }).success,
    ).toBe(false);
  });
});

describe("hasRole", () => {
  it("follows owner > manager > staff", () => {
    expect(hasRole("owner", "manager")).toBe(true);
    expect(hasRole("manager", "manager")).toBe(true);
    expect(hasRole("staff", "manager")).toBe(false);
    expect(hasRole(null, "staff")).toBe(false);
  });
});

describe("inviteSchema", () => {
  it("normalises the e-mail address", () => {
    expect(
      inviteSchema.parse({ email: "  Maria@Example.COM ", role: "staff" }),
    ).toEqual({ email: "maria@example.com", role: "staff" });
  });

  it("rejects the owner role and invalid e-mails", () => {
    expect(
      inviteSchema.safeParse({ email: "a@b.bg", role: "owner" }).success,
    ).toBe(false);
    expect(
      inviteSchema.safeParse({ email: "not-an-email", role: "staff" }).success,
    ).toBe(false);
  });
});
