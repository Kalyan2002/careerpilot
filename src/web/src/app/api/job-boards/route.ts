import { jobBoardSchema } from "@/api/contracts/job-board";
import { api } from "@/server/api/route";
import { db } from "@/server/db";

export const GET = api.route({}, ({ profileId }) =>
  db.jobBoard.findMany({ where: { profileId }, orderBy: { sortOrder: "asc" } }),
);

export const POST = api.route({ body: jobBoardSchema }, ({ body, profileId }) =>
  db.jobBoard.create({ data: { ...body, profileId } }),
);
