import { z } from "zod/v4";
import { patchOutreachMessageSchema } from "@/api/contracts/outreach";
import { campaignChannel } from "@/lib/sse/channels/campaign";
import { publish } from "@/lib/sse/server";
import { findOwned } from "@/server/api/owned";
import { api } from "@/server/api/route";
import { recomputeOutreachSummary } from "@/server/campaigns/summary";
import { db } from "@/server/db";

const outreachMessageParams = z.object({
  id: z.string(),
  messageId: z.coerce.number().int().positive(),
});

/**
 * Non-terminal edits to an outreach message — draft body/subject edits,
 * `draft → approved`, and (via `contactLinkedinConnection`) the parent
 * contact's connection state. Terminal outcomes go through `/result`.
 */
export const PATCH = api.route(
  { params: outreachMessageParams, body: patchOutreachMessageSchema },
  async ({ params, body, profileId }) => {
    const { id: campaignId, messageId } = params;

    await findOwned(
      (where) => db.outreachMessage.findFirst({ where, select: { id: true } }),
      { id: messageId, campaignId, profileId },
      "Outreach message",
    );

    const { contactLinkedinConnection, ...fields } = body;

    const updated = await db.$transaction(async (tx) => {
      const message = await tx.outreachMessage.update({
        where: { id: messageId },
        data: {
          status: fields.status,
          subject: fields.subject,
          body: fields.body,
          failReason: fields.failReason,
          providerId: fields.providerId,
          threadId: fields.threadId,
        },
        include: { contact: true },
      });

      if (contactLinkedinConnection) {
        await tx.contact.update({
          where: { id: message.contactId },
          data: { linkedinConnection: contactLinkedinConnection },
        });
        message.contact.linkedinConnection = contactLinkedinConnection;
      }

      // Tile counts only move on a status change; skip the recompute on draft edits.
      if (fields.status) {
        await recomputeOutreachSummary(tx, campaignId);
      }
      return message;
    });

    // Refresh the live campaign board (e.g. a regenerated draft) without a reload.
    publish(campaignChannel, { campaignId }, { type: "outreach-update" });
    return updated;
  },
);
