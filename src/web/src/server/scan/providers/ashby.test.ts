import { describe, expect, test } from "bun:test";
import { ashbyProvider, parseCompensation } from "./ashby";

describe("parseCompensation", () => {
  test("returns null when no compensation data", () => {
    expect(parseCompensation(undefined)).toBeNull();
    expect(parseCompensation({})).toBeNull();
  });

  test("annualizes a monthly range", () => {
    const result = parseCompensation({
      compensation: { interval: "1 MONTH", minValue: 5000, maxValue: 7000, currency: "usd" },
    });
    expect(result).toEqual({ min: 60000, max: 84000, currency: "USD" });
  });

  test("annualizes an hourly range", () => {
    const result = parseCompensation({
      compensation: { interval: "1 HOUR", minValue: 50, maxValue: 60, currency: "USD" },
    });
    expect(result).toEqual({ min: 104000, max: 124800, currency: "USD" });
  });

  test("handles only-min or only-max", () => {
    expect(parseCompensation({ compensation: { interval: "1 YEAR", minValue: 100000 } })).toEqual({
      min: 100000,
      max: 100000,
      currency: "",
    });
  });

  test("rejects invalid/negative values", () => {
    expect(
      parseCompensation({ compensation: { interval: "1 YEAR", minValue: "not-a-number" } }),
    ).toBeNull();
    expect(parseCompensation({ compensation: { interval: "1 YEAR", minValue: -5 } })).toBeNull();
  });

  test("unknown interval yields null", () => {
    expect(
      parseCompensation({ compensation: { interval: "1 FORTNIGHT", minValue: 1000 } }),
    ).toBeNull();
  });
});

describe("ashbyProvider.detect", () => {
  test("recognizes jobs.ashbyhq.com URLs", () => {
    expect(ashbyProvider.detect({ name: "Acme", careersUrl: "https://jobs.ashbyhq.com/acme" })).toBe(true);
    expect(ashbyProvider.detect({ name: "Acme", careersUrl: "https://acme.com/careers" })).toBe(false);
  });
});
