import { afterEach, describe, expect, test } from "bun:test";
import { workdayProvider } from "./workday";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("workdayProvider.detect", () => {
  test("recognizes a tenant.instance.myworkdayjobs.com URL", () => {
    expect(
      workdayProvider.detect({ name: "Acme", careersUrl: "https://acme.wd5.myworkdayjobs.com/careers" }),
    ).toBe(true);
  });

  test("rejects unrelated URLs", () => {
    expect(workdayProvider.detect({ name: "Acme", careersUrl: "https://acme.com/careers" })).toBe(false);
  });
});

describe("workdayProvider.fetch", () => {
  test("stops paginating once a page returns fewer than PAGE_SIZE", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(
        JSON.stringify({
          jobPostings: [{ title: "Engineer", externalPath: "/job/1", postedOn: "Posted Today" }],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const postings = await workdayProvider.fetch({
      name: "Acme",
      careersUrl: "https://acme.wd5.myworkdayjobs.com/careers",
    });
    expect(calls).toBe(1);
    expect(postings).toHaveLength(1);
    expect(postings[0].url).toBe("https://acme.wd5.myworkdayjobs.com/careers/job/1");
    expect(postings[0].postedAt).toBeGreaterThan(0);
  });

  test("skips postings without externalPath and omits date for '30+ Days Ago'", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          jobPostings: [
            { title: "No path" },
            { title: "Old posting", externalPath: "/job/2", postedOn: "Posted 30+ Days Ago" },
          ],
        }),
        { status: 200 },
      )) as unknown as typeof fetch;

    const postings = await workdayProvider.fetch({
      name: "Acme",
      careersUrl: "https://acme.wd5.myworkdayjobs.com/careers",
    });
    expect(postings).toHaveLength(1);
    expect(postings[0].postedAt).toBeUndefined();
  });
});
