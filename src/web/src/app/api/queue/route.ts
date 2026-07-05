import { z } from "zod/v4";
import { addQueueSchema } from "@/api/contracts/queue";
import type { Prisma } from "@/generated/prisma/client";
import { pipelineChannel } from "@/lib/sse/channels/pipeline";
import { publish } from "@/lib/sse/server";
import { api } from "@/server/api/route";
import { db } from "@/server/db";

export const GET = api.route(
  { query: z.object({ status: z.string().trim().min(1).optional() }) },
  ({ query, profileId }) => {
    const where: Prisma.QueueEntryWhereInput = { profileId };
    if (query.status) {
      where.status = query.status;
    }
    return db.queueEntry.findMany({ where, orderBy: { createdAt: "asc" } });
  },
);

export const POST = api.route({ body: addQueueSchema }, async ({ body, profileId }) => {
  const created = await db.$transaction(
    body.urls.map((u) =>
      db.queueEntry.upsert({
        where: { profileId_url: { profileId, url: u } },
        create: { profileId, url: u, note: body.note ?? null, status: "pending" },
        update: { note: body.note ?? null, status: "pending" },
      }),
    ),
  );
  publish(pipelineChannel, { profileId }, { type: "queue.updated" });
  return { inserted: created.length, items: created };
});
