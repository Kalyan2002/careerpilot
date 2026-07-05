import "server-only";
import type { EmailAccount } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { getProvider } from "@/server/email";

/**
 * Load the profile's connected email account, refreshing its access token
 * first when expired. Returns `null` when no account is connected. Mirrors the
 * refresh dance the sync route performs, so callers that need a usable token
 * (e.g. the send route) don't duplicate it.
 */
export async function loadFreshAccount(profileId: number): Promise<EmailAccount | null> {
  const account = await db.emailAccount.findUnique({ where: { profileId } });
  if (!account) {
    return null;
  }

  const now = new Date();
  if (account.refreshToken && account.tokenExpiresAt && account.tokenExpiresAt <= now) {
    const provider = getProvider(account.provider);
    const refreshed = await provider.refresh(account.refreshToken);

    return db.emailAccount.update({
      where: { id: account.id },
      data: {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? account.refreshToken,
        tokenExpiresAt: refreshed.expiresAt ?? null,
        scope: refreshed.scope ?? account.scope,
      },
    });
  }

  return account;
}
