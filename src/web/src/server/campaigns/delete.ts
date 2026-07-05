import "server-only";
import { findOwned } from "@/server/api/owned";
import { db } from "@/server/db";

interface DeleteCampaignInput {
  campaignId: string;
  profileId: number;
}

/**
 * Hard-delete a campaign and all of its related data. Prisma only cascades Job
 * and CampaignEvent; Application and OutreachMessage use `onDelete: SetNull`, so
 * they (and campaign-only contacts) are deleted explicitly inside a transaction
 * before the campaign row. Synced EmailMessages are kept (matchedAppId SetNull).
 */
export async function deleteCampaign(input: DeleteCampaignInput): Promise<{ campaignId: string }> {
  const { campaignId, profileId } = input;

  await findOwned(
    (where) => db.campaign.findFirst({ where }),
    { campaignId, profileId },
    "Campaign",
  );

  await db.$transaction(async (tx) => {
    const contactIds = (
      await tx.outreachMessage.findMany({
        where: { campaignId, profileId },
        select: { contactId: true },
      })
    ).map((m) => m.contactId);

    // Cascades StageEvent / ResumeVariant; SetNull on EmailMessage & Contact links.
    await tx.application.deleteMany({ where: { campaignId, profileId } });
    await tx.outreachMessage.deleteMany({ where: { campaignId, profileId } });

    // Only contacts left with no messages and no related application — i.e. ones
    // that existed solely for this campaign. Skips contacts referenced elsewhere.
    await tx.contact.deleteMany({
      where: { id: { in: contactIds }, profileId, messages: { none: {} }, relatedAppId: null },
    });

    // Cascades Job + CampaignEvent.
    await tx.campaign.delete({ where: { campaignId } });
  });

  return { campaignId };
}
