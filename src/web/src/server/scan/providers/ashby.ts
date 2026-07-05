/**
 * Ported from career-ops's providers/ashby.mjs — public posting-api endpoint.
 *
 * Ashby's public posting-api carries a ~10s+ server-side latency floor
 * (response time is independent of board size) and rate-limits repeated
 * unauthenticated hits, so this uses a longer timeout plus a backoff+jitter
 * retry (the backoff spaces requests out to dodge rate-limiting).
 */
import { fetchJson } from "../http";
import type { AtsCompensation, AtsEntry, AtsPosting, AtsProvider } from "./types";

const ASHBY_TIMEOUT_MS = 30_000;
const ASHBY_RETRIES = 2;

const INTERVAL_MULTIPLIERS: Record<string, number> = {
  "1 HOUR": 2080,
  "1 DAY": 260,
  "1 WEEK": 52,
  "2 WEEK": 26,
  "0.5 MONTH": 24,
  "1 MONTH": 12,
  "2 MONTH": 6,
  "3 MONTH": 4,
  "6 MONTH": 2,
  "1 YEAR": 1,
};

interface AshbyCompensation {
  interval?: string;
  minValue?: unknown;
  maxValue?: unknown;
  currency?: unknown;
}

interface AshbyJob {
  title?: string;
  jobUrl?: string;
  location?: string;
  compensation?: AshbyCompensation;
  publishedAt?: string;
}

/** Parse compensation data from an Ashby job object; null if no valid compensation. */
export function parseCompensation(job: AshbyJob | undefined): AtsCompensation | null {
  const comp = job?.compensation;
  if (!comp) return null;

  const interval = comp.interval || "1 YEAR";
  const multiplier = INTERVAL_MULTIPLIERS[interval];
  if (!multiplier) return null;

  // Coerce and validate numeric fields — malformed API payloads must not propagate.
  const normalizeNum = (v: unknown): number | null => {
    if (v == null) return null;
    if (typeof v === "string" && v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const minValue = normalizeNum(comp.minValue);
  const maxValue = normalizeNum(comp.maxValue);
  const currency = typeof comp.currency === "string" ? comp.currency.trim() : "";

  if (minValue == null && maxValue == null) return null;

  const min = minValue != null ? minValue * multiplier : null;
  const max = maxValue != null ? maxValue * multiplier : null;
  if (min == null && max == null) return null;

  const resolvedMin = min ?? (max as number);
  const resolvedMax = max ?? (min as number);
  return {
    min: Math.min(resolvedMin, resolvedMax),
    max: Math.max(resolvedMin, resolvedMax),
    currency: currency.toUpperCase(),
  };
}

function resolveApiUrl(entry: AtsEntry): string | null {
  const url = entry.careersUrl || "";
  const match = url.match(/jobs\.ashbyhq\.com\/([^/?#]+)/);
  if (!match) return null;
  return `https://api.ashbyhq.com/posting-api/job-board/${match[1]}?includeCompensation=true`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toEpochMs(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export const ashbyProvider: AtsProvider = {
  id: "ashby",

  detect(entry) {
    return resolveApiUrl(entry) !== null;
  },

  async fetch(entry): Promise<AtsPosting[]> {
    const apiUrl = resolveApiUrl(entry);
    if (!apiUrl) throw new Error(`ashby: cannot derive API URL for ${entry.name}`);
    let lastErr: unknown;
    for (let attempt = 0; attempt <= ASHBY_RETRIES; attempt++) {
      if (attempt > 0) {
        // exponential backoff + jitter — spaces out retries to dodge Ashby rate-limiting
        const backoff = 1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
        await sleep(backoff);
      }
      try {
        const json = (await fetchJson(apiUrl, { timeoutMs: ASHBY_TIMEOUT_MS })) as {
          jobs?: AshbyJob[];
        };
        const jobs = Array.isArray(json?.jobs) ? json.jobs : [];
        return jobs.map((j) => ({
          title: j.title || "",
          url: j.jobUrl || "",
          company: entry.name,
          location: j.location || "",
          salary: parseCompensation(j),
          postedAt: toEpochMs(j.publishedAt),
        }));
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  },
};
