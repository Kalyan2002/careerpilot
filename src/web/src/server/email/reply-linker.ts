import "server-only";
import { db } from "@/server/db";

/** The fields the linker needs from a freshly-synced inbound message. */
export interface InboundForLinking {
  threadId: string | null;
  fromAddress: string;
  receivedAt: Date;
}

/**
 * Flip `sent` outreach messages to `replied` when a matching inbound email
 * arrives. Matches first by Gmail `threadId` (the thread the outreach was sent
 * on), then falls back to the sender address equalling a contact's email.
 * Called from the sync route after new messages are persisted. Returns the
 * number of outreach messages newly marked replied.
 */
export async function linkOutreachReplies(
  profileId: number,
  messages: InboundForLinking[],
): Promise<number> {
  let linked = 0;

  for (const m of messages) {
    if (m.threadId) {
      const byThread = await db.outreachMessage.updateMany({
        where: { profileId, status: "sent", threadId: m.threadId },
        data: { status: "replied", repliedAt: m.receivedAt },
      });
      linked += byThread.count;
      if (byThread.count > 0) continue;
    }

    if (m.fromAddress) {
      const contacts = await db.contact.findMany({
        where: { profileId, email: m.fromAddress },
        select: { id: true },
      });
      if (contacts.length > 0) {
        const byEmail = await db.outreachMessage.updateMany({
          where: { profileId, status: "sent", contactId: { in: contacts.map((c) => c.id) } },
          data: { status: "replied", repliedAt: m.receivedAt },
        });
        linked += byEmail.count;
      }
    }
  }

  return linked;
}
