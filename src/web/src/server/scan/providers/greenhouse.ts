/** Ported from career-ops's providers/greenhouse.mjs — public boards-api JSON endpoint. */
import { fetchJson } from "../http";
import type { AtsEntry, AtsPosting, AtsProvider } from "./types";

const ALLOWED_GREENHOUSE_HOSTS = new Set([
  "boards-api.greenhouse.io",
  "boards.greenhouse.io",
  "job-boards.greenhouse.io",
  "job-boards.eu.greenhouse.io",
]);

function assertGreenhouseUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`greenhouse: invalid URL: ${url}`);
  }
  if (parsed.protocol !== "https:") throw new Error(`greenhouse: URL must use HTTPS: ${url}`);
  if (!ALLOWED_GREENHOUSE_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `greenhouse: untrusted hostname "${parsed.hostname}" — must be one of: ${[...ALLOWED_GREENHOUSE_HOSTS].join(", ")}`,
    );
  }
  return url;
}

function resolveApiUrl(entry: AtsEntry): string | null {
  if (entry.api) {
    assertGreenhouseUrl(entry.api);
    return entry.api;
  }
  const url = entry.careersUrl || "";
  const match = url.match(/job-boards(?:\.eu)?\.greenhouse\.io\/([^/?#]+)/);
  if (match) return `https://boards-api.greenhouse.io/v1/boards/${match[1]}/jobs`;
  return null;
}

// NaN-safe Date.parse — `|| undefined` would also coerce a valid epoch 0.
function toEpochMs(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

interface GreenhouseJob {
  title?: string;
  absolute_url?: string;
  location?: { name?: string };
  first_published?: string;
}

export const greenhouseProvider: AtsProvider = {
  id: "greenhouse",

  detect(entry) {
    try {
      return resolveApiUrl(entry) !== null;
    } catch {
      return false;
    }
  },

  async fetch(entry): Promise<AtsPosting[]> {
    const apiUrl = resolveApiUrl(entry);
    if (!apiUrl) throw new Error(`greenhouse: cannot derive API URL for ${entry.name}`);
    assertGreenhouseUrl(apiUrl);
    // redirect:'error' prevents SSRF via server-side redirects; combined with
    // assertGreenhouseUrl above it guarantees the final hostname stays in the allowlist.
    const json = (await fetchJson(apiUrl, { redirect: "error" })) as { jobs?: GreenhouseJob[] };
    const jobs = Array.isArray(json?.jobs) ? json.jobs : [];
    return jobs
      .filter((j) => j.absolute_url)
      .map((j) => ({
        title: j.title || "",
        url: j.absolute_url as string,
        company: entry.name,
        location: j.location?.name || "",
        postedAt: toEpochMs(j.first_published),
      }));
  },
};
