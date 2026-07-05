import { z } from "zod/v4";
import { addCampaignOutreachSchema } from "@/api/contracts/outreach";
import { campaignChannel } from "@/lib/sse/channels/campaign";
import { publish } from "@/lib/sse/server";
import { notFound } from "@/server/api/errors";
import { findOwned } from "@/server/api/owned";
import { api } from "@/server/api/route";
import { recomputeOutreachSummary } from "@/server/campaigns/summary";
import { db } from "@/server/db";
import { createContactPayload } from "@/server/outreach/contact";

const campaignParams = z.object({ id: z.string() });

/** List the campaign's outreach messages (with their contacts) for the board. */
export const GET = api.route({ params: campaignParams }, ({ params, profileId }) =>
  db.outreachMessage.findMany({
    where: { campaignId: params.id, profileId },
    include: { contact: true },
    orderBy: { id: "asc" },
  }),
);

/**
 * Add a discovered contact (or attach to an existing `contactId`) plus an
 * initial draft message to the campaign, then recompute the campaign summary.
 * Mirrors the campaigns/[id]/jobs create shape.
 */
export const POST = api.route(
  { params: campaignParams, body: addCampaignOutreachSchema },
  async ({ params, body, profileId }) => {
    const { id } = params;
    await findOwned(
      (where) => db.campaign.findFirst({ where, select: { campaignId: true } }),
      { campaignId: id, profileId },
      "Campaign",
    );

    const { contact, contactId, message } = body;

    const result = await db.$transaction(async (tx) => {
      let resolvedContactId = contactId;

      if (resolvedContactId != null) {
        const existing = await tx.contact.findFirst({
          where: { id: resolvedContactId, profileId },
          select: { id: true },
        });
        if (!existing) {
          return null;
        }
      } else if (contact) {
        const created = await tx.contact.create({
          data: { profileId, ...createContactPayload(contact) },
        });
        resolvedContactId = created.id;
      }

      const outreachMessage = await tx.outreachMessage.create({
        data: {
          profileId,
          contactId: resolvedContactId!,
          campaignId: id,
          channel: message.channel,
          linkedinKind: message.linkedinKind ?? null,
          subject: message.subject ?? null,
          body: message.body,
          status: message.status ?? "draft",
        },
        include: { contact: true },
      });

      const summary = await recomputeOutreachSummary(tx, id);
      return { outreachMessage, summary };
    });

    if (!result) {
      throw notFound("Contact not found");
    }

    // Push the new contact/message to the live campaign viewer.
    publish(campaignChannel, { campaignId: id }, { type: "outreach-update" });
    return result.outreachMessage;
  },
);
