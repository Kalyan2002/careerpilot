import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getActiveProfileId } from "@/server/active-profile";
import { badRequest, HttpError } from "@/server/api/errors";
import { ErrorCodes } from "@/server/api/response";
import { api } from "@/server/api/route";
import { completeEmailOAuth } from "@/server/email/oauth";

const callbackQuery = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

export const GET = api.route({ public: true, query: callbackQuery }, async ({ req, query }) => {
  if (query.error) {
    throw new HttpError(ErrorCodes.UNPROCESSABLE, `OAuth error: ${query.error}`, 400);
  }
  if (!query.code || !query.state) {
    throw badRequest("Missing code or state");
  }

  const jar = await cookies();
  const expectedState = jar.get("email_oauth_state")?.value;
  const providerName = jar.get("email_oauth_provider")?.value ?? "gmail";
  if (!expectedState || expectedState !== query.state) {
    throw badRequest("OAuth state mismatch");
  }

  const profileId = await getActiveProfileId();
  await completeEmailOAuth({ providerName, code: query.code, profileId });

  const res = NextResponse.redirect(new URL("/inbox", req.url));
  res.cookies.delete("email_oauth_state");
  res.cookies.delete("email_oauth_provider");
  return res;
});
