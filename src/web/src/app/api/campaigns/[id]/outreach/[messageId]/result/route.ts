import { z } from "zod/v4";
import { outreachMessageResultSchema } from "@/api/contracts/outreach";
import { api } from "@/server/api/route";
import { recordOutreachResult } from "@/server/campaigns/outreach-result";

const params = z.object({
  id: z.string(),
  messageId: z.coerce.number().int().positive(),
});

export const POST = api.route(
  { params, body: outreachMessageResultSchema },
  ({ params, body, profileId }) =>
    recordOutreachResult({
      campaignId: params.id,
      messageId: params.messageId,
      profileId,
      data: body,
    }),
);
