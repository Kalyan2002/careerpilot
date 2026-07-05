import { describe, expect, test } from "bun:test";
import { expandSynonyms, normalizeKeyword, normalizePhrase } from "./keyword-normalize";

describe("normalizeKeyword", () => {
  test("lowercases input", () => {
    expect(normalizeKeyword("React")).toBe("react");
    expect(normalizeKeyword("AWS")).toBe("aws");
  });

  test("strips all non-alphanumerics with no replacement", () => {
    expect(normalizeKeyword("Next.js")).toBe("nextjs");
    expect(normalizeKeyword("Node.js")).toBe("nodejs");
    expect(normalizeKeyword("React Native")).toBe("reactnative");
    expect(normalizeKeyword("c++")).toBe("c");
    expect(normalizeKeyword("c#")).toBe("c");
  });

  test("preserves digits", () => {
    expect(normalizeKeyword("ES2022")).toBe("es2022");
    expect(normalizeKeyword("k8s")).toBe("k8s");
    expect(normalizeKeyword("S3")).toBe("s3");
  });

  test("empty / whitespace input collapses to empty", () => {
    expect(normalizeKeyword("")).toBe("");
    expect(normalizeKeyword("   ")).toBe("");
    expect(normalizeKeyword("!!!")).toBe("");
  });

  test("idempotent on canonical input", () => {
    const once = normalizeKeyword("Next.JS");
    expect(normalizeKeyword(once)).toBe(once);
  });
});

describe("normalizePhrase", () => {
  test("lowercases and trims", () => {
    expect(normalizePhrase("  React  ")).toBe("react");
  });

  test("collapses non-alphanumerics to single spaces", () => {
    expect(normalizePhrase("Next.js")).toBe("next js");
    expect(normalizePhrase("React-Native")).toBe("react native");
    expect(normalizePhrase("React  Native")).toBe("react native");
    expect(normalizePhrase("ES.6/2015")).toBe("es 6 2015");
  });

  test("strips trailing punctuation", () => {
    expect(normalizePhrase("Built React UI!")).toBe("built react ui");
    expect(normalizePhrase("...hello...")).toBe("hello");
  });

  test("empty / whitespace input → empty", () => {
    expect(normalizePhrase("")).toBe("");
    expect(normalizePhrase("   ")).toBe("");
    expect(normalizePhrase("///")).toBe("");
  });
});

describe("expandSynonyms", () => {
  test("returns compact + spaced form of the input term", () => {
    const variants = expandSynonyms("Next.js");
    expect(variants).toContain("nextjs");
    expect(variants).toContain("next js");
  });

  test("expands canonical alias to alternate spellings", () => {
    const variants = expandSynonyms("nextjs");
    expect(variants).toContain("nextjs");
    expect(variants).toContain("next");
  });

  test("expands alternate spelling to canonical and other variants", () => {
    const variants = expandSynonyms("next.js");
    expect(variants).toContain("nextjs");
    expect(variants).toContain("next");
  });

  test("is case-insensitive", () => {
    const lower = expandSynonyms("javascript");
    const upper = expandSynonyms("JAVASCRIPT");
    expect(new Set(upper)).toEqual(new Set(lower));
  });

  test("js ↔ javascript", () => {
    expect(expandSynonyms("js")).toContain("javascript");
    expect(expandSynonyms("javascript")).toContain("js");
  });

  test("ts ↔ typescript", () => {
    expect(expandSynonyms("ts")).toContain("typescript");
    expect(expandSynonyms("typescript")).toContain("ts");
  });

  test("k8s ↔ kubernetes", () => {
    expect(expandSynonyms("k8s")).toContain("kubernetes");
    expect(expandSynonyms("kubernetes")).toContain("k8s");
  });

  test("unknown term returns only its own variants (no synonym pollution)", () => {
    const variants = expandSynonyms("rust");
    expect(variants).toContain("rust");
    expect(variants).not.toContain("typescript");
    expect(variants).not.toContain("javascript");
  });

  test("empty input returns empty array", () => {
    expect(expandSynonyms("")).toEqual([]);
  });

  test("returns deduplicated variants", () => {
    const variants = expandSynonyms("react");
    expect(new Set(variants).size).toBe(variants.length);
  });

  test("memoization returns identical array reference for repeated calls", () => {
    const a = expandSynonyms("typescript");
    const b = expandSynonyms("typescript");
    expect(a).toBe(b);
  });

  test("memoization keys on raw input — different cases are different keys", () => {
    const lower = expandSynonyms("typescript");
    const upper = expandSynonyms("TYPESCRIPT");
    expect(new Set(upper)).toEqual(new Set(lower));
  });

  test("dotnet ↔ .net", () => {
    expect(expandSynonyms(".net")).toContain("dotnet");
    expect(expandSynonyms("dotnet")).toContain("net");
  });

  test("golang ↔ go", () => {
    expect(expandSynonyms("go")).toContain("golang");
    expect(expandSynonyms("golang")).toContain("go");
  });
});
