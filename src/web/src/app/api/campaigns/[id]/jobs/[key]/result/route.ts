import { z } from "zod/v4";
import { campaignJobResultSchema } from "@/api/contracts/campaign";
import { api } from "@/server/api/route";
import { recordJobResult } from "@/server/campaigns/job-result";

const params = z.object({ id: z.string(), key: z.string() });

export const POST = api.route(
  { params, body: campaignJobResultSchema },
  ({ params, body, profileId }) =>
    recordJobResult({ campaignId: params.id, key: params.key, profileId, data: body }),
);
