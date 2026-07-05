import { sendEmailSchema } from "@/api/contracts/outreach";
import { HttpError } from "@/server/api/errors";
import { ErrorCodes } from "@/server/api/response";
import { api } from "@/server/api/route";
import { accountCanSend, getProvider } from "@/server/email";
import { loadFreshAccount } from "@/server/email/account";

/**
 * Send an outbound email from the profile's connected mailbox. Used by the
 * outreach skill (and the outreach board's "approve & send" action). Refreshes
 * an expired token first and 400s with an actionable message when the account
 * lacks send scope (needs reconnecting).
 */
export const POST = api.route({ body: sendEmailSchema }, async ({ body, profileId }) => {
  const account = await loadFreshAccount(profileId);
  if (!account) {
    throw new HttpError(ErrorCodes.NOT_FOUND, "No email account connected", 404);
  }
  if (!accountCanSend(account)) {
    throw new HttpError(
      ErrorCodes.UNPROCESSABLE,
      "Connected mailbox lacks send access. Reconnect it from email settings to enable sending.",
      422,
    );
  }

  try {
    return await getProvider(account.provider).sendMessage(account, {
      to: body.to,
      subject: body.subject,
      body: body.body,
      threadId: body.threadId,
      attachments: body.attachments,
    });
  } catch (e) {
    throw new HttpError(
      ErrorCodes.UNPROCESSABLE,
      e instanceof Error ? e.message : "Failed to send message",
      502,
    );
  }
});
