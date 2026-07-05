import { inboxChannel } from "@/lib/sse/channels/inbox";
import { publish } from "@/lib/sse/server";
import { HttpError, notFound } from "@/server/api/errors";
import { ErrorCodes } from "@/server/api/response";
import { db } from "@/server/db";
import { getProvider } from "@/server/email";
import { loadFreshAccount } from "@/server/email/account";
import { linkOutreachReplies, type InboundForLinking } from "@/server/email/reply-linker";

export async function syncInbox(profileId: number) {
  let active;
  try {
    active = await loadFreshAccount(profileId);
  } catch (e) {
    throw new HttpError(
      ErrorCodes.UNPROCESSABLE,
      e instanceof Error ? e.message : "Token refresh failed",
      401,
    );
  }
  if (!active) {
    throw notFound("No email account connected");
  }

  const provider = getProvider(active.provider);

  publish(inboxChannel, undefined, { type: "sync.started" });

  const result = await provider.syncMessages(active);

  let inserted = 0;
  const insertedForLinking: InboundForLinking[] = [];
  for (const m of result.newMessages) {
    try {
      await db.emailMessage.create({
        data: {
          accountId: active.id,
          providerId: m.providerId,
          threadId: m.threadId,
          subject: m.subject,
          fromAddress: m.fromAddress,
          fromName: m.fromName,
          fromDomain: m.fromDomain,
          snippet: m.snippet,
          rawBody: m.rawBody,
          receivedAt: m.receivedAt,
        },
      });
      inserted += 1;
      insertedForLinking.push({
        threadId: m.threadId,
        fromAddress: m.fromAddress,
        receivedAt: m.receivedAt,
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        continue;
      }
      throw e;
    }
  }

  // Flip any sent outreach messages to "replied" when their reply just arrived.
  await linkOutreachReplies(profileId, insertedForLinking);

  await db.emailAccount.update({
    where: { id: active.id },
    data: {
      historyId: result.historyId ?? active.historyId,
      lastSyncAt: new Date(),
    },
  });

  publish(inboxChannel, undefined, {
    type: "sync.progress",
    fetched: result.fetched,
    new: inserted,
  });

  return { fetched: result.fetched, new: inserted };
}
