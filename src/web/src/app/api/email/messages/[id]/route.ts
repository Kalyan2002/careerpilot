import { scanMessageSchema } from "@/api/contracts/email";
import { idParam } from "@/api/contracts/shared";
import { inboxChannel } from "@/lib/sse/channels/inbox";
import { publish } from "@/lib/sse/server";
import { findOwned } from "@/server/api/owned";
import { api } from "@/server/api/route";
import { db } from "@/server/db";

export const GET = api.route({ params: idParam }, ({ params, profileId }) =>
  findOwned(
    (where) =>
      db.emailMessage.findFirst({
        where,
        include: {
          matchedApp: { select: { id: true, title: true, company: true, stage: true } },
        },
      }),
    { id: params.id, account: { profileId } },
    "Message",
  ),
);

export const PATCH = api.route(
  { params: idParam, body: scanMessageSchema },
  async ({ params, body, profileId }) => {
    await findOwned(
      (where) => db.emailMessage.findFirst({ where, select: { id: true } }),
      { id: params.id, account: { profileId } },
      "Message",
    );

    const message = await db.emailMessage.update({
      where: { id: params.id },
      data: {
        classification: body.classification,
        confidence: body.confidence,
        reasoning: body.reasoning,
        matchedAppId: body.matchedAppId,
        matchScore: body.matchScore,
        appliedStage: body.appliedStage,
        reviewStatus: body.reviewStatus,
        verificationCode: body.verificationCode,
        verificationLink: body.verificationLink,
        verificationDomain: body.verificationDomain,
        scannedAt: body.classification ? new Date() : undefined,
      },
    });

    publish(inboxChannel, undefined, { type: "message.scanned", id: params.id });

    return message;
  },
);
