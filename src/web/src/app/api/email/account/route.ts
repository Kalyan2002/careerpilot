import { api } from "@/server/api/route";
import { db } from "@/server/db";
import { accountCanSend } from "@/server/email";

export const GET = api.route({}, async ({ profileId }) => {
  const account = await db.emailAccount.findUnique({ where: { profileId } });

  if (!account) {
    return { connected: false, canSend: false };
  }

  return {
    connected: true,
    provider: account.provider,
    email: account.email,
    lastSyncAt: account.lastSyncAt,
    canSend: accountCanSend(account),
  };
});

export const DELETE = api.route({}, async ({ profileId }) => {
  await db.emailAccount.deleteMany({ where: { profileId } });
  return { disconnected: true };
});
