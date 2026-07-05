import "server-only";
import { campaignChannel } from "@/lib/sse/channels/campaign";
import { pipelineChannel } from "@/lib/sse/channels/pipeline";
import { publish } from "@/lib/sse/server";
import { db } from "@/server/db";

const STALE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Flip `in_progress` campaigns whose `updatedAt` is older than
 * {@link STALE_THRESHOLD_MS} to `interrupted`, and revert their `applying` jobs
 * to `approved` so `/resume <campaignId>` can pick them up. Emits SSE per campaign.
 * Called from campaigns GET handlers; no background timer.
 */
export async function reconcileStaleCampaigns(profileId: number): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  const stale = await db.campaign.findMany({
    where: {
      profileId,
      status: "in_progress",
      updatedAt: { lt: cutoff },
    },
    select: { campaignId: true, source: true },
  });

  if (stale.length === 0) {
    return 0;
  }

  await db.$transaction([
    db.campaign.updateMany({
      where: { campaignId: { in: stale.map((r) => r.campaignId) } },
      data: { status: "interrupted" },
    }),
    db.job.updateMany({
      where: { campaignId: { in: stale.map((r) => r.campaignId) }, status: "applying" },
      data: { status: "approved" },
    }),
  ]);

  for (const r of stale) {
    publish(
      campaignChannel,
      { campaignId: r.campaignId },
      { type: "status", payload: { status: "interrupted" } },
    );
    publish(
      pipelineChannel,
      { profileId },
      {
        type: "campaign.updated",
        campaignId: r.campaignId,
        status: "interrupted",
        source: r.source,
      },
    );
  }

  return stale.length;
}
