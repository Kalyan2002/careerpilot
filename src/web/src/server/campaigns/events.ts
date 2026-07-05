import type { z } from "zod/v4";
import type { campaignEventSchema } from "@/api/contracts/campaign";
import { campaignChannel, type CampaignEvent } from "@/lib/sse/channels/campaign";
import { publish } from "@/lib/sse/server";
import { findOwned } from "@/server/api/owned";
import { db } from "@/server/db";

interface RecordCampaignEventInput {
  campaignId: string;
  profileId: number;
  event: z.infer<typeof campaignEventSchema>;
}

export async function recordCampaignEvent({
  campaignId,
  profileId,
  event,
}: RecordCampaignEventInput) {
  await findOwned(
    (where) => db.campaign.findFirst({ where, select: { campaignId: true } }),
    { campaignId, profileId },
    "Campaign",
  );

  const created = await db.campaignEvent.create({
    data: { campaignId, type: event.type, payload: JSON.stringify(event.payload) },
  });
  publish(campaignChannel, { campaignId }, {
    type: event.type,
    payload: event.payload,
  } as CampaignEvent);
  return { id: created.id };
}
