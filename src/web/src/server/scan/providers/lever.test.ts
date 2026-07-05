import { afterEach, describe, expect, test } from "bun:test";
import { leverProvider } from "./lever";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("leverProvider", () => {
  test("detect recognizes jobs.lever.co URLs", () => {
    expect(leverProvider.detect({ name: "Acme", careersUrl: "https://jobs.lever.co/acme" })).toBe(true);
    expect(leverProvider.detect({ name: "Acme", careersUrl: "https://acme.com/careers" })).toBe(false);
  });

  test("fetch maps the postings array", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify([
          {
            text: "Backend Engineer",
            hostedUrl: "https://jobs.lever.co/acme/abc",
            categories: { location: "Berlin" },
            createdAt: 1700000000000,
          },
        ]),
        { status: 200 },
      )) as unknown as typeof fetch;

    const postings = await leverProvider.fetch({ name: "Acme", careersUrl: "https://jobs.lever.co/acme" });
    expect(postings).toEqual([
      {
        title: "Backend Engineer",
        url: "https://jobs.lever.co/acme/abc",
        company: "Acme",
        location: "Berlin",
        postedAt: 1700000000000,
      },
    ]);
  });

  test("fetch returns empty array for a non-array response", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    const postings = await leverProvider.fetch({ name: "Acme", careersUrl: "https://jobs.lever.co/acme" });
    expect(postings).toEqual([]);
  });
});
