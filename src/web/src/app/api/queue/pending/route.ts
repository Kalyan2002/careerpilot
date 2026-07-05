import { api } from "@/server/api/route";
import { db } from "@/server/db";

export const GET = api.route({}, ({ profileId }) =>
  db.queueEntry.findMany({
    where: { profileId, status: "pending" },
    orderBy: { createdAt: "asc" },
  }),
);
