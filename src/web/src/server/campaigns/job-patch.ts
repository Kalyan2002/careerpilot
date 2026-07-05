import type { z } from "zod/v4";
import type { patchCampaignJobSchema } from "@/api/contracts/campaign";
import { campaignChannel } from "@/lib/sse/channels/campaign";
import { pipelineChannel } from "@/lib/sse/channels/pipeline";
import { publish } from "@/lib/sse/server";
import { findOwned } from "@/server/api/owned";
import { recomputeCampaignSummary } from "@/server/campaigns/summary";
import { db } from "@/server/db";

interface PatchCampaignJobInput {
  campaignId: string;
  key: string;
  profileId: number;
  patch: z.infer<typeof patchCampaignJobSchema>;
}

export async function patchCampaignJob({
  campaignId,
  key,
  profileId,
  patch,
}: PatchCampaignJobInput) {
  await findOwned(
    (where) => db.job.findFirst({ where, select: { campaignId: true } }),
    { campaignId, key, campaign: { profileId } },
    "Campaign job",
  );

  const job = await db.job.update({
    where: { campaignId_key: { campaignId, key } },
    data: {
      status: patch.status,
      appliedAt: patch.appliedAt ? new Date(patch.appliedAt) : null,
      failReason: patch.failReason,
      retryNotes: patch.retryNotes,
      skipReason: patch.skipReason,
      matchScore: patch.matchScore,
      matchReason: patch.matchReason,
      description: patch.description,
      digest: patch.digest,
    },
  });

  if (job.status === "applied" || job.status === "failed" || job.status === "skipped") {
    const queueStatus = job.status === "skipped" ? "skipped" : "consumed";
    await db.queueEntry.updateMany({
      where: { profileId, url: job.url, status: "pending" },
      data: {
        status: queueStatus,
        consumedAt: queueStatus === "consumed" ? new Date() : null,
      },
    });
  }

  publish(
    campaignChannel,
    { campaignId },
    { type: "job-update", payload: { kind: "updated", job } },
  );

  if (patch.status) {
    const summary = await recomputeCampaignSummary(db, campaignId);
    publish(campaignChannel, { campaignId }, { type: "progress", payload: summary });
  }

  publish(
    pipelineChannel,
    { profileId },
    { type: "campaignjob.updated", campaignId, key, status: patch.status },
  );

  return job;
}
