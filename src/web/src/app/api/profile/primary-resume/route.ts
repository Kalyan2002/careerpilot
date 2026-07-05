import { z } from "zod/v4";
import { findOwned } from "@/server/api/owned";
import { api } from "@/server/api/route";
import { db } from "@/server/db";

const bodySchema = z.object({
  resumeId: z.number().int().positive().nullable(),
});

export const POST = api.route({ body: bodySchema }, async ({ body, profileId }) => {
  if (body.resumeId !== null) {
    await findOwned(
      (where) => db.resume.findFirst({ where, select: { id: true } }),
      { id: body.resumeId, profileId },
      "Resume",
    );
  }

  await db.profile.update({
    where: { id: profileId },
    data: { primaryResumeId: body.resumeId },
  });

  return { primaryResumeId: body.resumeId };
});
