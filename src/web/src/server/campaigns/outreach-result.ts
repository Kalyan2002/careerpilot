import type { z } from "zod/v4";
import type { outreachMessageResultSchema } from "@/api/contracts/outreach";
import { campaignChannel } from "@/lib/sse/channels/campaign";
import { publish } from "@/lib/sse/server";
import { findOwned } from "@/server/api/owned";
import { recomputeOutreachSummary } from "@/server/campaigns/summary";
import { db } from "@/server/db";

interface RecordOutreachResultInput {
  campaignId: string;
  messageId: number;
  profileId: number;
  data: z.infer<typeof outreachMessageResultSchema>;
}

/**
 * Terminal-outcome handoff for an outreach message: marks it `sent`/`failed`/
 * `skipped`, stamps `sentAt` + the Gmail `providerId`/`threadId` (so the reply
 * linker can match a reply later), and recomputes the campaign summary.
 * Mirrors campaigns/[id]/jobs/[key]/result.
 */
export async function recordOutreachResult(input: RecordOutreachResultInput) {
  const { campaignId, messageId, profileId, data } = input;
  const existing = await findOwned(
    (where) => db.outreachMessage.findFirst({ where }),
    { id: messageId, campaignId, profileId },
    "Outreach message",
  );

  const sentAt =
    data.outcome === "sent" ? (data.sentAt ? new Date(data.sentAt) : new Date()) : null;

  const result = await db.$transaction(async (tx) => {
    const message = await tx.outreachMessage.update({
      where: { id: messageId },
      data: {
        status: data.outcome,
        sentAt,
        providerId: data.outcome === "sent" ? (data.providerId ?? existing.providerId) : null,
        threadId:
          data.outcome === "sent" ? (data.threadId ?? existing.threadId) : existing.threadId,
        failReason: data.outcome === "failed" ? data.failReason : null,
      },
      include: { contact: true },
    });
    const summary = await recomputeOutreachSummary(tx, campaignId);
    return { message, summary };
  });

  // Refresh the live campaign viewer on the terminal outcome.
  publish(campaignChannel, { campaignId }, { type: "outreach-update" });
  return { message: result.message, summary: result.summary };
}
