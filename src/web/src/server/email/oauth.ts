import { randomBytes } from "node:crypto";
import { badRequest, HttpError } from "@/server/api/errors";
import { ErrorCodes } from "@/server/api/response";
import { db } from "@/server/db";
import { getProvider } from "@/server/email";

export function buildAuthorizeUrl(providerName: string): { authorizeUrl: string; state: string } {
  if (providerName !== "gmail") {
    throw badRequest(`Unsupported provider: ${providerName}`);
  }

  const state = randomBytes(16).toString("hex");
  let authorizeUrl: string;
  try {
    authorizeUrl = getProvider(providerName).getAuthorizeUrl(state);
  } catch (e) {
    throw new HttpError(
      ErrorCodes.UNPROCESSABLE,
      e instanceof Error ? e.message : "Email provider unavailable",
      400,
    );
  }

  return { authorizeUrl, state };
}

interface CompleteEmailOAuthInput {
  providerName: string;
  code: string;
  profileId: number;
}

export async function completeEmailOAuth({
  providerName,
  code,
  profileId,
}: CompleteEmailOAuthInput): Promise<{ email: string }> {
  const provider = getProvider(providerName);
  const { tokens, email } = await provider.exchangeCode(code);

  await db.emailAccount.upsert({
    where: { profileId },
    create: {
      profileId,
      provider: providerName,
      email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      tokenExpiresAt: tokens.expiresAt ?? null,
      scope: tokens.scope ?? null,
    },
    update: {
      provider: providerName,
      email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      tokenExpiresAt: tokens.expiresAt ?? null,
      scope: tokens.scope ?? null,
    },
  });

  return { email };
}
