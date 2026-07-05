import { afterEach, describe, expect, test } from "bun:test";
import { greenhouseProvider } from "./greenhouse";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("greenhouseProvider.detect", () => {
  test("recognizes job-boards.greenhouse.io careers URLs", () => {
    expect(greenhouseProvider.detect({ name: "Acme", careersUrl: "https://job-boards.greenhouse.io/acme" })).toBe(
      true,
    );
  });

  test("rejects unrelated URLs", () => {
    expect(greenhouseProvider.detect({ name: "Acme", careersUrl: "https://jobs.lever.co/acme" })).toBe(false);
  });
});

describe("greenhouseProvider.fetch", () => {
  test("rejects an explicit api URL on an untrusted host (SSRF guard)", async () => {
    await expect(
      greenhouseProvider.fetch({ name: "Acme", api: "https://evil.example.com/v1/boards/acme/jobs" }),
    ).rejects.toThrow(/untrusted hostname/);
  });

  test("rejects a non-https explicit api URL", async () => {
    await expect(
      greenhouseProvider.fetch({ name: "Acme", api: "http://boards-api.greenhouse.io/v1/boards/acme/jobs" }),
    ).rejects.toThrow(/must use HTTPS/);
  });

  test("maps postings from the boards-api response", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          jobs: [
            {
              title: "Senior Engineer",
              absolute_url: "https://job-boards.greenhouse.io/acme/jobs/1",
              location: { name: "Remote" },
              first_published: "2026-01-01T00:00:00Z",
            },
            { title: "No URL", absolute_url: null },
          ],
        }),
        { status: 200 },
      )) as unknown as typeof fetch;

    const postings = await greenhouseProvider.fetch({
      name: "Acme",
      careersUrl: "https://job-boards.greenhouse.io/acme",
    });
    expect(postings).toHaveLength(1);
    expect(postings[0]).toMatchObject({
      title: "Senior Engineer",
      company: "Acme",
      location: "Remote",
    });
    expect(postings[0].postedAt).toBeGreaterThan(0);
  });
});
