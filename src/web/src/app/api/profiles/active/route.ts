import { NextResponse } from "next/server";
import { z } from "zod/v4";
import {
  ACTIVE_PROFILE_COOKIE,
  getActiveProfileIdOrNull,
  setActiveProfileId,
} from "@/server/active-profile";
import { notFound } from "@/server/api/errors";
import { api } from "@/server/api/route";
import { db } from "@/server/db";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const GET = api.route({ public: true }, async () => ({
  profileId: await getActiveProfileIdOrNull(),
}));

const bodySchema = z.object({ profileId: z.number().int().positive() });

export const POST = api.route({ public: true, body: bodySchema }, async ({ body }) => {
  const { profileId } = body;
  const exists = await db.profile.findUnique({ where: { id: profileId }, select: { id: true } });
  if (!exists) {
    throw notFound("Profile not found");
  }

  await setActiveProfileId(profileId);

  // Raw response so we can attach the active-profile cookie (escape hatch).
  const res = NextResponse.json({ ok: true, data: { profileId } });
  res.cookies.set(ACTIVE_PROFILE_COOKIE, String(profileId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS,
  });
  return res;
});
