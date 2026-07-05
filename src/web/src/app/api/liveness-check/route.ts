import { z } from "zod/v4";
import { api } from "@/server/api/route";
import { classifyLiveness } from "@/server/scan/liveness-core";

const requestSchema = z.object({
  status: z.number().optional(),
  finalUrl: z.string().optional(),
  bodyText: z.string().optional(),
  applyControls: z.array(z.string()).optional(),
});

/**
 * Stateless posting-liveness classifier. The agent (via Playwright MCP)
 * navigates to the posting and snapshots the page, then POSTs the extracted
 * text/status/apply-control labels here rather than re-deriving the
 * classification heuristics itself every time.
 */
export const POST = api.route({ body: requestSchema, public: true }, ({ body }) =>
  classifyLiveness(body),
);
