import { stageTransitionSchema } from "@/api/contracts/application";
import { idParam } from "@/api/contracts/shared";
import { findOwned } from "@/server/api/owned";
import { api } from "@/server/api/route";
import { db } from "@/server/db";

const POSITIVE_STAGES = new Set([
  "recruiter_screen",
  "assessment",
  "hiring_manager_screen",
  "technical_interview",
  "onsite",
  "offer",
]);

export const POST = api.route(
  { params: idParam, body: stageTransitionSchema },
  async ({ params, body, profileId }) => {
    const { id } = params;
    const existing = await findOwned(
      (where) => db.application.findFirst({ where }),
      { id, profileId },
      "Application",
    );

    const fromStage = existing.stage;
    const toStage = body.toStage;

    if (fromStage === toStage) {
      return { id, stage: toStage, unchanged: true };
    }

    const outcome =
      toStage === "rejected" ? "negative" : POSITIVE_STAGES.has(toStage) ? "positive" : null;
    const rejectedAt = toStage === "rejected" ? new Date() : null;

    await db.$transaction([
      db.application.update({
        where: { id },
        data: { stage: toStage, outcome, rejectedAt },
      }),
      db.stageEvent.create({
        data: {
          applicationId: id,
          fromStage,
          toStage,
          note: body.note ?? null,
        },
      }),
    ]);

    return { id, stage: toStage };
  },
);
