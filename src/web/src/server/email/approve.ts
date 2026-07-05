import type { ApproveInput } from "@/api/contracts/email";
import { inboxChannel } from "@/lib/sse/channels/inbox";
import { publish } from "@/lib/sse/server";
import { HttpError, notFound } from "@/server/api/errors";
import { findOwned } from "@/server/api/owned";
import { ErrorCodes } from "@/server/api/response";
import { db } from "@/server/db";

const POSITIVE_STAGES = new Set([
  "recruiter_screen",
  "assessment",
  "hiring_manager_screen",
  "technical_interview",
  "onsite",
  "offer",
]);

const CLASSIFICATION_TO_STAGE: Record<string, string> = {
  interviewing: "recruiter_screen",
  rejected: "rejected",
  offer: "offer",
};

interface ApproveEmailReplyInput {
  messageId: number;
  profileId: number;
  body: ApproveInput;
}

export async function approveEmailReply({
  messageId: id,
  profileId,
  body,
}: ApproveEmailReplyInput) {
  const message = await findOwned(
    (where) => db.emailMessage.findFirst({ where }),
    { id, account: { profileId } },
    "Message",
  );

  if (!message.matchedAppId) {
    throw new HttpError(ErrorCodes.UNPROCESSABLE, "Message has no matched application", 422);
  }

  const inferred =
    body.toStage ??
    message.appliedStage ??
    (message.classification ? CLASSIFICATION_TO_STAGE[message.classification] : undefined);

  if (!inferred) {
    throw new HttpError(ErrorCodes.UNPROCESSABLE, "No target stage available", 422);
  }

  const app = await db.application.findFirst({
    where: { id: message.matchedAppId, profileId },
  });
  if (!app) {
    throw notFound("Application not found");
  }

  const fromStage = app.stage;
  const toStage = inferred;
  const outcome =
    toStage === "rejected" ? "negative" : POSITIVE_STAGES.has(toStage) ? "positive" : null;
  const rejectedAt = toStage === "rejected" ? new Date() : null;

  await db.$transaction([
    db.application.update({
      where: { id: app.id },
      data: { stage: toStage, outcome, rejectedAt },
    }),
    db.stageEvent.create({
      data: {
        applicationId: app.id,
        fromStage,
        toStage,
        note: body.note ?? `From email: ${message.subject}`,
      },
    }),
    db.emailMessage.update({
      where: { id },
      data: { reviewStatus: "approved", appliedStage: toStage },
    }),
  ]);

  publish(inboxChannel, undefined, { type: "message.reviewed", id, status: "approved" });

  return { id, applicationId: app.id, stage: toStage };
}
