import "server-only";
import type { CoverLetterCreate } from "@/api/contracts/cover-letter";
import { findOwned } from "@/server/api/owned";
import { db } from "@/server/db";

const LIST_SELECT = {
  id: true,
  jobTitle: true,
  company: true,
  jobUrl: true,
  source: true,
  createdAt: true,
} as const;

/** The active profile's cover letters, newest first (no body — list payload). */
export function listCoverLetters(profileId: number) {
  return db.coverLetter.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    select: LIST_SELECT,
  });
}

export function createCoverLetter(profileId: number, data: CoverLetterCreate) {
  return db.coverLetter.create({
    data: {
      profileId,
      content: data.content,
      jobUrl: data.jobUrl ?? null,
      jobTitle: data.jobTitle ?? null,
      company: data.company ?? null,
      source: data.source,
    },
  });
}

export function getCoverLetter(id: number, profileId: number) {
  return findOwned(
    (where) => db.coverLetter.findFirst({ where }),
    { id, profileId },
    "Cover letter",
  );
}

export async function deleteCoverLetter(id: number, profileId: number): Promise<void> {
  await getCoverLetter(id, profileId);
  await db.coverLetter.delete({ where: { id } });
}
