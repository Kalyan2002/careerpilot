import { z } from "zod/v4";
import { addCampaignJobSchema } from "@/api/contracts/campaign";
import { campaignChannel } from "@/lib/sse/channels/campaign";
import { pipelineChannel } from "@/lib/sse/channels/pipeline";
import { publish } from "@/lib/sse/server";
import { findOwned } from "@/server/api/owned";
import { api } from "@/server/api/route";
import { db } from "@/server/db";

const campaignParams = z.object({ id: z.string() });

export const GET = api.route({ params: campaignParams }, ({ params, profileId }) =>
  db.job.findMany({
    where: { campaignId: params.id, campaign: { profileId } },
    orderBy: { id: "asc" },
  }),
);

export const POST = api.route(
  { params: campaignParams, body: addCampaignJobSchema },
  async ({ params, body, profileId }) => {
    const { id } = params;
    await findOwned(
      (where) => db.campaign.findFirst({ where, select: { campaignId: true } }),
      { campaignId: id, profileId },
      "Campaign",
    );

    const job = await db.job.create({
      data: {
        campaignId: id,
        key: body.key,
        title: body.title,
        company: body.company,
        location: body.location ?? null,
        salary: body.salary ?? null,
        type: body.type ?? null,
        url: body.url,
        board: body.board ?? null,
        matchScore: body.matchScore ?? null,
        matchReason: body.matchReason ?? null,
        status: body.status ?? "pending",
        description: body.description ?? null,
        digest: body.digest ?? null,
      },
    });

    await db.queueEntry.updateMany({
      where: { profileId, url: job.url, status: "pending" },
      data: { status: "consumed", consumedAt: new Date() },
    });

    publish(
      campaignChannel,
      { campaignId: id },
      {
        type: "job-update",
        payload: { kind: "added", job },
      },
    );
    publish(
      pipelineChannel,
      { profileId },
      {
        type: "campaignjob.created",
        campaignId: id,
        key: job.key,
      },
    );

    return job;
  },
);
