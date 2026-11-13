import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/businesses/varna/x?tab=1", "/businesses/varna/x?tab=1"],
  ])("keeps relative path %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it.each([
    "//evil.com",
    "https://evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "",
    "/x\n/y",
    null,
    42,
  ])("rejects %s", (input) => {
    expect(safeRedirectPath(input, "/fallback")).toBe("/fallback");
  });
});
