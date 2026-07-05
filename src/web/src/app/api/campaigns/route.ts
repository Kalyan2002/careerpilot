import { z } from "zod/v4";
import { createCampaignSchema } from "@/api/contracts/campaign";
import type { Prisma } from "@/generated/prisma/client";
import { api } from "@/server/api/route";
import { reconcileStaleCampaigns } from "@/server/campaigns/reconcile";
import { db } from "@/server/db";

const campaignsQuery = z.object({
  status: z.string().optional(),
  source: z.string().optional(),
});

export const GET = api.route({ query: campaignsQuery }, async ({ query, profileId }) => {
  await reconcileStaleCampaigns(profileId);

  const where: Prisma.CampaignWhereInput = { profileId };

  if (query.status) where.status = query.status;
  if (query.source) where.source = query.source;

  const campaigns = await db.campaign.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: 200,
  });

  return campaigns.map((r) => ({
    ...r,
    config: JSON.parse(r.config) as Record<string, unknown>,
    summary: JSON.parse(r.summary) as Record<string, unknown>,
  }));
});

export const POST = api.route({ body: createCampaignSchema }, ({ body, profileId }) =>
  db.campaign.create({
    data: {
      campaignId: body.campaignId,
      profileId,
      query: body.query,
      source: body.source,
      config: JSON.stringify(body.config ?? {}),
    },
  }),
);
