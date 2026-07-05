/** Ported from career-ops's providers/lever.mjs — public postings endpoint. */
import { fetchJson } from "../http";
import type { AtsEntry, AtsPosting, AtsProvider } from "./types";

function resolveApiUrl(entry: AtsEntry): string | null {
  const url = entry.careersUrl || "";
  const match = url.match(/jobs\.lever\.co\/([^/?#]+)/);
  if (!match) return null;
  return `https://api.lever.co/v0/postings/${match[1]}`;
}

interface LeverJob {
  text?: string;
  hostedUrl?: string;
  categories?: { location?: string };
  createdAt?: number;
}

export const leverProvider: AtsProvider = {
  id: "lever",

  detect(entry) {
    return resolveApiUrl(entry) !== null;
  },

  async fetch(entry): Promise<AtsPosting[]> {
    const apiUrl = resolveApiUrl(entry);
    if (!apiUrl) throw new Error(`lever: cannot derive API URL for ${entry.name}`);
    const json = (await fetchJson(apiUrl)) as LeverJob[];
    if (!Array.isArray(json)) return [];
    return json.map((j) => ({
      title: j.text || "",
      url: j.hostedUrl || "",
      company: entry.name,
      location: j.categories?.location || "",
      postedAt: typeof j.createdAt === "number" ? j.createdAt : undefined,
    }));
  },
};
