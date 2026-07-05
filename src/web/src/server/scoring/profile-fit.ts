import type { ResumeData } from "@/api/contracts/resume";
import { scoreFit, type FitProfile, type FitResult, type JobDigest } from "@/server/scoring/fit";

/** Calculates the number of years since the earliest experience date in the resume content */
export function yearsSinceEarliestExperience(content: ResumeData): number | null {
  const dates = (content.experience ?? [])
    .map((e) => e.start)
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .map((s) => new Date(s))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) {
    return null;
  }

  const yearsDiff = (Date.now() - dates[0].getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.max(0, Math.round(yearsDiff));
}

/** Derives the fit inputs for a profile based on their resume content */
export function deriveProfileFitInputs(content: ResumeData): {
  techStack: string[];
  yearsExperience: number | null;
} {
  const techStack = (content.skills ?? []).flatMap((group) => group.items ?? []).filter(Boolean);
  return { techStack, yearsExperience: yearsSinceEarliestExperience(content) };
}

interface ScoreJobFitInput {
  profileId: number;
  digest: JobDigest;
  profile?: Partial<FitProfile>;
}

/**
 * Loads the active profile's primary resume, derives fit inputs from it, merges
 * any caller-provided profile overrides, and scores the job digest.
 */
export async function scoreJobFit({
  profileId,
  digest,
  profile,
}: ScoreJobFitInput): Promise<FitResult> {
  // Imported lazily so the pure helpers above stay importable in unit tests
  // without pulling in `server-only`/Prisma.
  const { db } = await import("@/server/db");

  const found = await db.profile.findUnique({
    where: { id: profileId },
    select: { primaryResumeId: true },
  });

  let derived = { techStack: [] as string[], yearsExperience: null as number | null };

  if (found?.primaryResumeId) {
    const resume = await db.resume.findUnique({
      where: { id: found.primaryResumeId },
      select: { content: true },
    });

    if (resume?.content) {
      try {
        derived = deriveProfileFitInputs(JSON.parse(resume.content) as ResumeData);
      } catch {
        // resume content malformed — fall back to caller-provided profile only
      }
    }
  }

  const fitProfile = {
    techStack: profile?.techStack ?? derived.techStack,
    yearsExperience:
      profile?.yearsExperience !== undefined ? profile.yearsExperience : derived.yearsExperience,
  };

  return scoreFit(digest, fitProfile);
}
