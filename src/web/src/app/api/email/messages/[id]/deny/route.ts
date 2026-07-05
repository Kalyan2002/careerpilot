import { idParam } from "@/api/contracts/shared";
import { inboxChannel } from "@/lib/sse/channels/inbox";
import { publish } from "@/lib/sse/server";
import { findOwned } from "@/server/api/owned";
import { api } from "@/server/api/route";
import { db } from "@/server/db";

export const POST = api.route({ params: idParam }, async ({ params, profileId }) => {
  await findOwned(
    (where) => db.emailMessage.findFirst({ where, select: { id: true } }),
    { id: params.id, account: { profileId } },
    "Message",
  );

  await db.emailMessage.update({
    where: { id: params.id },
    data: { reviewStatus: "denied" },
  });

  publish(inboxChannel, undefined, { type: "message.reviewed", id: params.id, status: "denied" });

  return { id: params.id, status: "denied" };
});
