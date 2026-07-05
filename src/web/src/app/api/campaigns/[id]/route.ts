import { z } from "zod/v4";
import { updateCampaignSchema } from "@/api/contracts/campaign";
import type { Prisma } from "@/generated/prisma/client";
import { campaignChannel } from "@/lib/sse/channels/campaign";
import { pipelineChannel } from "@/lib/sse/channels/pipeline";
import { publish } from "@/lib/sse/server";
import { findOwned } from "@/server/api/owned";
import { api } from "@/server/api/route";
import { deleteCampaign } from "@/server/campaigns/delete";
import { reconcileStaleCampaigns } from "@/server/campaigns/reconcile";
import { summarizeJobs } from "@/server/campaigns/summary";
import { db } from "@/server/db";
import { cleanReplacementCharsNullable } from "@/utils/text";

const campaignParams = z.object({ id: z.string() });

export const GET = api.route({ params: campaignParams }, async ({ params, profileId }) => {
  const { id } = params;
  await reconcileStaleCampaigns(profileId);

  const campaign = await findOwned(
    (where) => db.campaign.findFirst({ where, include: { jobs: { orderBy: { id: "asc" } } } }),
    { campaignId: id, profileId },
    "Campaign",
  );

  return {
    ...campaign,
    // Clean replacement-char artifacts in historical rows written before the
    // schema-level sanitizer landed, so the UI never shows mojibake.
    jobs: campaign.jobs.map((job) => ({
      ...job,
      skipReason: cleanReplacementCharsNullable(job.skipReason),
      failReason: cleanReplacementCharsNullable(job.failReason),
      matchReason: cleanReplacementCharsNullable(job.matchReason),
      retryNotes: cleanReplacementCharsNullable(job.retryNotes),
    })),
    config: JSON.parse(campaign.config) as Record<string, unknown>,
    // Job-based campaigns derive the summary from their loaded jobs so the tiles
    // always match the rows; outreach campaigns have no jobs, so their
    // recomputed `Campaign.summary` (OutreachMessage aggregates) is authoritative.
    summary:
      campaign.source === "outreach"
        ? (JSON.parse(campaign.summary) as Record<string, unknown>)
        : summarizeJobs(campaign.jobs),
  };
});

export const PATCH = api.route(
  { params: campaignParams, body: updateCampaignSchema },
  async ({ params, body, profileId }) => {
    const { id } = params;
    const existing = await findOwned(
      (where) => db.campaign.findFirst({ where }),
      { campaignId: id, profileId },
      "Campaign",
    );

    const update: Prisma.CampaignUpdateInput = { status: body.status };

    if (body.summary) {
      update.summary = JSON.stringify({ ...JSON.parse(existing.summary), ...body.summary });
    }
    if (body.config) {
      update.config = JSON.stringify({ ...JSON.parse(existing.config), ...body.config });
    }
    if (body.completedAt !== undefined) {
      update.completedAt = body.completedAt ? new Date(body.completedAt) : null;
    }

    const campaign = await db.campaign.update({ where: { campaignId: id }, data: update });

    if (body.status) {
      publish(
        campaignChannel,
        { campaignId: id },
        {
          type: "status",
          payload: { status: body.status },
        },
      );
      publish(
        pipelineChannel,
        { profileId },
        body.status === "completed"
          ? { type: "campaign.completed", campaignId: id }
          : {
              type: "campaign.updated",
              campaignId: id,
              status: body.status,
              source: existing.source,
            },
      );
    }
    if (body.summary) {
      publish(
        campaignChannel,
        { campaignId: id },
        { type: "progress", payload: JSON.parse(campaign.summary) },
      );
    }

    return {
      ...campaign,
      config: JSON.parse(campaign.config) as Record<string, unknown>,
      summary: JSON.parse(campaign.summary) as Record<string, unknown>,
    };
  },
);

export const DELETE = api.route({ params: campaignParams }, async ({ params, profileId }) => {
  const { id } = params;
  await deleteCampaign({ campaignId: id, profileId });
  publish(pipelineChannel, { profileId }, { type: "campaign.deleted", campaignId: id });
  return { deleted: true, campaignId: id };
});
