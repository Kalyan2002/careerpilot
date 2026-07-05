import { patchQueueSchema } from "@/api/contracts/queue";
import { idParam } from "@/api/contracts/shared";
import { findOwned } from "@/server/api/owned";
import { api } from "@/server/api/route";
import { db } from "@/server/db";

const findEntry = (id: number, profileId: number) =>
  findOwned(
    (where) => db.queueEntry.findFirst({ where, select: { id: true } }),
    { id, profileId },
    "Queue entry",
  );

export const PATCH = api.route(
  { params: idParam, body: patchQueueSchema },
  async ({ params, body, profileId }) => {
    await findEntry(params.id, profileId);
    return db.queueEntry.update({
      where: { id: params.id },
      data: {
        status: body.status,
        consumedAt: body.status === "consumed" ? new Date() : null,
      },
    });
  },
);

export const DELETE = api.route({ params: idParam }, async ({ params, profileId }) => {
  await findEntry(params.id, profileId);
  await db.queueEntry.delete({ where: { id: params.id } });
  return { deleted: params.id };
});
