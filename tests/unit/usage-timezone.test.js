import { describe, expect, it } from "vitest";
import { getDateKeyInTimeZone, normalizeTimeZone } from "@/lib/db/repos/usageRepo.js";

describe("usage timezone helpers", () => {
  it("buckets dates in requested browser timezone", () => {
    const timestamp = "2026-07-01T06:30:00.000Z";

    expect(getDateKeyInTimeZone(timestamp, "UTC")).toBe("2026-07-01");
    expect(getDateKeyInTimeZone(timestamp, "America/Los_Angeles")).toBe("2026-06-30");
  });

  it("falls back when timezone is invalid", () => {
    expect(normalizeTimeZone("not/a-zone")).toBeTruthy();
  });
});
