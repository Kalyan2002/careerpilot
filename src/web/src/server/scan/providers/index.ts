import { ashbyProvider } from "./ashby";
import { greenhouseProvider } from "./greenhouse";
import { leverProvider } from "./lever";
import type { AtsEntry, AtsPosting, AtsProvider } from "./types";
import { workdayProvider } from "./workday";

export type { AtsCompensation, AtsEntry, AtsPosting, AtsProvider } from "./types";

/** Checked in order; first provider whose careers_url/api pattern matches wins. */
const PROVIDERS: AtsProvider[] = [greenhouseProvider, leverProvider, ashbyProvider, workdayProvider];

export function detectAtsProvider(entry: AtsEntry): AtsProvider | null {
  return PROVIDERS.find((p) => p.detect(entry)) ?? null;
}

/**
 * Zero-LLM-token board scan: if `entry.careersUrl` (or `entry.api`) matches a
 * known ATS's public API pattern, fetch postings directly via HTTP+JSON.
 * Returns null when no provider recognizes the entry — callers should fall
 * back to agent-driven Playwright MCP browsing for that board.
 */
export async function fetchAtsPostings(entry: AtsEntry): Promise<AtsPosting[] | null> {
  const provider = detectAtsProvider(entry);
  if (!provider) return null;
  return provider.fetch(entry);
}
