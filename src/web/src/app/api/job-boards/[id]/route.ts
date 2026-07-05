import { jobBoardPatchSchema } from "@/api/contracts/job-board";
import { idParam } from "@/api/contracts/shared";
import { findOwned } from "@/server/api/owned";
import { api } from "@/server/api/route";
import { db } from "@/server/db";

const findBoard = (id: number, profileId: number) =>
  findOwned(
    (where) => db.jobBoard.findFirst({ where, select: { id: true } }),
    { id, profileId },
    "Board",
  );

export const PATCH = api.route(
  { params: idParam, body: jobBoardPatchSchema },
  async ({ params, body, profileId }) => {
    await findBoard(params.id, profileId);
    return db.jobBoard.update({ where: { id: params.id }, data: body });
  },
);

export const DELETE = api.route({ params: idParam }, async ({ params, profileId }) => {
  await findBoard(params.id, profileId);
  await db.jobBoard.delete({ where: { id: params.id } });
  return { deleted: params.id };
});
