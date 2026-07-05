import type { z } from "zod/v4";
import type { campaignJobResultSchema } from "@/api/contracts/campaign";
import { campaignChannel } from "@/lib/sse/channels/campaign";
import { pipelineChannel } from "@/lib/sse/channels/pipeline";
import { publish } from "@/lib/sse/server";
import { findOwned } from "@/server/api/owned";
import { recomputeCampaignSummary } from "@/server/campaigns/summary";
import { db } from "@/server/db";
import { normalizeCompanyName, normalizeJobTitle } from "@/server/scoring/applied-duplicates";

interface RecordJobResultInput {
  campaignId: string;
  key: string;
  profileId: number;
  data: z.infer<typeof campaignJobResultSchema>;
}

/**
 * Terminal-outcome handoff for a Job. Atomically updates Job status,
 * upserts the Application row (when `applied`), marks the QueueEntry
 * consumed/skipped, and recomputes Campaign.summary from the post-update
 * Job aggregates. Replaces the apply/auto-apply skills' multi-curl
 * dance with a single POST.
 */
export async function recordJobResult({ campaignId, key, profileId, data }: RecordJobResultInput) {
  const existing = await findOwned(
    (where) =>
      db.job.findFirst({
        where,
        include: { campaign: { select: { source: true, summary: true } } },
      }),
    { campaignId, key, campaign: { profileId } },
    "Campaign job",
  );

  const appliedAt = data.outcome === "applied" ? new Date(data.appliedAt as string) : null;

  const result = await db.$transaction(async (tx) => {
    const job = await tx.job.update({
      where: { campaignId_key: { campaignId, key } },
      data: {
        status: data.outcome,
        appliedAt: data.outcome === "applied" ? appliedAt : null,
        failReason: data.outcome === "failed" ? data.failReason : null,
        skipReason: data.outcome === "skipped" ? data.skipReason : null,
        retryNotes: data.retryNotes,
        matchScore: data.matchScore,
      },
    });

    let application = null;
    let applicationCreated = false;

    if (data.outcome === "applied") {
      const found = await tx.application.findUnique({
        where: { profileId_url: { profileId, url: job.url } },
      });

      if (found) {
        application = found;
      } else {
        application = await tx.application.create({
          data: {
            profileId,
            url: job.url,
            title: job.title,
            company: job.company,
            location: job.location,
            board: job.board,
            source: existing.campaign.source as string,
            campaignId,
            matchScore: job.matchScore,
            matchReason: job.matchReason,
            normalizedTitle: normalizeJobTitle(job.title),
            normalizedCompany: normalizeCompanyName(job.company),
            appliedAt: appliedAt!,
            stageEvents: { create: { fromStage: null, toStage: "applied" } },
          },
        });
        applicationCreated = true;
      }
    }

    const queueStatus = data.outcome === "skipped" ? "skipped" : "consumed";
    await tx.queueEntry.updateMany({
      where: { profileId, url: job.url, status: "pending" },
      data: {
        status: queueStatus,
        consumedAt: queueStatus === "consumed" ? new Date() : null,
      },
    });

    const summary = await recomputeCampaignSummary(tx, campaignId);

    return { job, application, applicationCreated, summary };
  });

  publish(
    campaignChannel,
    { campaignId },
    { type: "job-update", payload: { kind: "updated", job: result.job } },
  );
  publish(campaignChannel, { campaignId }, { type: "progress", payload: result.summary });
  publish(
    pipelineChannel,
    { profileId },
    { type: "campaignjob.updated", campaignId, key, status: data.outcome },
  );
  if (result.applicationCreated) {
    publish(pipelineChannel, { profileId }, { type: "application.created", campaignId });
  }

  return {
    campaignJob: result.job,
    application: result.application,
    summary: result.summary,
  };
}
