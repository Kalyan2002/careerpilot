import { NextResponse } from "next/server";
import { idParam } from "@/api/contracts/shared";
import {
  ACTIVE_PROFILE_COOKIE,
  getActiveProfileIdOrNull,
  setActiveProfileId,
} from "@/server/active-profile";
import { conflict, HttpError, notFound } from "@/server/api/errors";
import { ErrorCodes } from "@/server/api/response";
import { api } from "@/server/api/route";
import { db } from "@/server/db";
import { deleteAllResumeArtifacts } from "@/server/storage";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const DELETE = api.route({ public: true, params: idParam }, async ({ params }) => {
  const { id } = params;

  const profile = await db.profile.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });
  if (!profile) {
    throw notFound("Profile not found");
  }

  const total = await db.profile.count();
  if (total <= 1) {
    throw conflict("Cannot delete the only remaining profile");
  }

  const resumes = await db.resume.findMany({
    where: { profileId: id },
    select: {
      id: true,
      sourceFilename: true,
      variants: { select: { id: true } },
    },
  });

  const cookieActiveId = await getActiveProfileIdOrNull();
  const wasActive = profile.isActive || cookieActiveId === id;

  await db.profile.delete({ where: { id } });

  await Promise.all(
    resumes.map((r) =>
      deleteAllResumeArtifacts({
        resumeId: r.id,
        sourceFilename: r.sourceFilename,
        variantIds: r.variants.map((v) => v.id),
      }),
    ),
  );

  let activeProfileId: number;

  if (wasActive) {
    const next = await db.profile.findFirst({
      orderBy: { id: "asc" },
      select: { id: true },
    });

    if (!next) {
      throw new HttpError(ErrorCodes.INTERNAL, "No surviving profile after delete", 500);
    }
    await setActiveProfileId(next.id);
    activeProfileId = next.id;
  } else {
    activeProfileId = cookieActiveId ?? id;
  }

  // Raw response so we can attach the active-profile cookie (escape hatch).
  const res = NextResponse.json({
    ok: true,
    data: { deleted: id, activeProfileId },
  });

  if (wasActive) {
    res.cookies.set(ACTIVE_PROFILE_COOKIE, String(activeProfileId), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: ONE_YEAR_SECONDS,
    });
  }
  return res;
});
