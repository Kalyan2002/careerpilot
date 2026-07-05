import type { ResumeData } from "@/api/contracts/resume";
import { HttpError, notFound } from "@/server/api/errors";
import { findOwned } from "@/server/api/owned";
import { ErrorCodes } from "@/server/api/response";
import { db } from "@/server/db";
import { backfillResumeIds } from "@/server/resumes/backfill-ids";
import { validateRewrites } from "@/server/resumes/rewrite";
import { tailorBase } from "@/server/resumes/tailor";

export interface TailorVariantBody {
  label: string;
  jobUrl?: string | null;
  applicationId?: number | null;
  summary?: string;
  emphasizedTech?: string[];
  jobKeywords?: string[];
  diffNotes?: string | null;
  maxBulletsPerEntry?: number;
  rewordTopN?: number;
  bulletRewrites?: { entryIndex: number; bullets: { original: string; tailored: string }[] }[];
}

interface CreateTailoredVariantInput {
  resumeId: number;
  profileId: number;
  body: TailorVariantBody;
}

interface TailoredVariantResult {
  id: number;
  pdfUrl: string;
  rewordedBullets: number;
  flags: string[];
}

/**
 * Create a tailored resume variant from model-authored hints. The model
 * never writes structured ResumeData — just a tailored `summary` and a
 * small `emphasizedTech`/`jobKeywords` array. The server applies a
 * deterministic ranking against the base content.
 */
export async function createTailoredVariant({
  resumeId,
  profileId,
  body,
}: CreateTailoredVariantInput): Promise<TailoredVariantResult> {
  const base = await findOwned(
    (where) => db.resume.findFirst({ where }),
    { id: resumeId, profileId },
    "Resume",
  );

  if (!base.content) {
    throw new HttpError(
      ErrorCodes.UNPROCESSABLE,
      "Base resume has no structured content. Run extract-resume first.",
      422,
    );
  }

  if (body.applicationId) {
    const app = await db.application.findUnique({
      where: { id: body.applicationId },
      select: { id: true },
    });
    if (!app) {
      throw notFound("Application not found");
    }
  }

  const { content: baseContent } = backfillResumeIds(JSON.parse(base.content) as ResumeData);

  const rewordTopN = body.rewordTopN ?? 2;
  const rewrites = body.bulletRewrites ?? [];
  const validation = validateRewrites(baseContent, rewrites, rewordTopN);

  if (!validation.ok) {
    throw new HttpError(
      ErrorCodes.UNPROCESSABLE,
      "Rewrite validation failed",
      422,
      validation.violations,
    );
  }

  const tailored = tailorBase(baseContent, {
    summary: body.summary,
    emphasizedTech: body.emphasizedTech,
    jobKeywords: body.jobKeywords,
    maxBulletsPerEntry: body.maxBulletsPerEntry,
    bulletRewrites: validation.map,
    rewordTopN,
  });

  const rewordedBullets = validation.audit.reduce((n, e) => n + e.bullets.length, 0);
  const flags = validation.audit.flatMap((e) => e.bullets.flatMap((b) => b.flags));

  const variant = await db.resumeVariant.create({
    data: {
      resumeId,
      label: body.label,
      jobUrl: body.jobUrl ?? null,
      applicationId: body.applicationId ?? null,
      content: JSON.stringify(tailored),
      diffNotes: body.diffNotes ?? null,
      rewrites: rewordedBullets > 0 ? JSON.stringify({ experience: validation.audit }) : null,
    },
  });

  return {
    id: variant.id,
    pdfUrl: `/api/resumes/variants/${variant.id}/pdf`,
    rewordedBullets,
    flags,
  };
}
