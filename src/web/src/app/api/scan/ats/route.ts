import { z } from "zod/v4";
import { api } from "@/server/api/route";
import { fetchAtsPostings } from "@/server/scan/providers";

const requestSchema = z.object({
  name: z.string(),
  careersUrl: z.string().optional(),
  api: z.string().optional(),
});

/**
 * Zero-token board scan: give it a company name + careers URL, and if it's
 * backed by a known ATS (Greenhouse/Lever/Ashby/Workday) this returns the
 * current postings directly via HTTP+JSON — no browser, no LLM cost.
 * Returns `{ supported: false }` when no provider recognizes the URL, so the
 * agent knows to fall back to Playwright-MCP browsing for that board.
 */
export const POST = api.route({ body: requestSchema, public: true }, async ({ body }) => {
  const postings = await fetchAtsPostings({
    name: body.name,
    careersUrl: body.careersUrl,
    api: body.api,
  });
  if (postings === null) {
    return { supported: false as const };
  }
  return { supported: true as const, postings };
});
