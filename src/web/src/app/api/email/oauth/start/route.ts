import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { api } from "@/server/api/route";
import { buildAuthorizeUrl } from "@/server/email/oauth";

const startQuery = z.object({ provider: z.string().optional() });

export const GET = api.route({ public: true, query: startQuery }, ({ query }) => {
  const providerName = query.provider ?? "gmail";

  const { authorizeUrl, state } = buildAuthorizeUrl(providerName);

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set("email_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/email/oauth",
    maxAge: 600,
  });
  res.cookies.set("email_oauth_provider", providerName, {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/email/oauth",
    maxAge: 600,
  });
  return res;
});
