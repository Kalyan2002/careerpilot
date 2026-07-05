import "server-only";
import { cookies } from "next/headers";
import { notFound } from "@/server/api/errors";
import { db } from "@/server/db";

export const ACTIVE_PROFILE_COOKIE = "careerpilot:active_profile";

export async function getActiveProfileId(): Promise<number> {
  const raw = (await cookies()).get(ACTIVE_PROFILE_COOKIE)?.value;
  const cookieId = raw ? Number(raw) : null;

  if (cookieId && Number.isInteger(cookieId)) {
    const hit = await db.profile.findUnique({ where: { id: cookieId }, select: { id: true } });
    if (hit) {
      return cookieId;
    }
  }

  const active = await db.profile.findFirst({ where: { isActive: true }, select: { id: true } });
  if (active) {
    return active.id;
  }

  const first = await db.profile.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
  if (!first) {
    throw notFound("No active profile. Complete onboarding.");
  }
  return first.id;
}

export async function getActiveProfileIdOrNull(): Promise<number | null> {
  try {
    return await getActiveProfileId();
  } catch {
    return null;
  }
}

export async function setActiveProfileId(profileId: number): Promise<void> {
  await db.$transaction([
    db.profile.updateMany({ where: { isActive: true }, data: { isActive: false } }),
    db.profile.update({ where: { id: profileId }, data: { isActive: true } }),
  ]);
}
