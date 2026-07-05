import { writeFile } from "node:fs/promises";
import { z } from "zod/v4";
import { resumeDataSchema, type ResumeData } from "@/api/contracts/resume";
import { idParam } from "@/api/contracts/shared";
import type { ResumeDto } from "@/api/types";
import { resumeChannel } from "@/lib/sse/channels/resume";
import { publish } from "@/lib/sse/server";
import { badRequest } from "@/server/api/errors";
import { findOwned } from "@/server/api/owned";
import { api } from "@/server/api/route";
import { db } from "@/server/db";
import { backfillResumeIds } from "@/server/resumes/backfill-ids";
import {
  deleteAllResumeArtifacts,
  ensureResumeBackupsDir,
  resumeBackupPath,
} from "@/server/storage";

export const GET = api.route({ params: idParam }, async ({ params, profileId }) => {
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { primaryResumeId: true },
  });
  const resume = await findOwned(
    (where) => db.resume.findFirst({ where }),
    { id: params.id, profileId },
    "Resume",
  );

  let content: ResumeData | null = null;

  if (resume.content) {
    const parsed = JSON.parse(resume.content) as ResumeData;
    const { content: backfilled, mutated } = backfillResumeIds(parsed);
    content = backfilled;
    if (mutated) {
      await db.resume.update({
        where: { id: resume.id },
        data: { content: JSON.stringify(backfilled) },
      });
    }
  }

  const dto: ResumeDto = {
    id: resume.id,
    profileId: resume.profileId,
    label: resume.label,
    content,
    version: resume.version,
    sourceFilename: resume.sourceFilename,
    sourceMimeType: resume.sourceMimeType,
    sourceSizeBytes: resume.sourceSizeBytes,
    isPrimary: profile?.primaryResumeId === resume.id,
    createdAt: resume.createdAt.toISOString(),
    updatedAt: resume.updatedAt.toISOString(),
  };
  return dto;
});

const putSchema = z.object({
  label: z.string().min(1).optional(),
  content: resumeDataSchema.optional(),
});

export const PUT = api.route(
  { params: idParam, body: putSchema },
  async ({ params, body, profileId }) => {
    if (body.label === undefined && body.content === undefined) {
      throw badRequest("label or content required");
    }

    const existing = await findOwned(
      (where) => db.resume.findFirst({ where }),
      { id: params.id, profileId },
      "Resume",
    );

    const updated = await db.resume.update({
      where: { id: params.id },
      data: {
        label: body.label ?? existing.label,
        content: body.content ? JSON.stringify(body.content) : existing.content,
        version: body.content ? existing.version + 1 : existing.version,
      },
    });

    if (body.content) {
      await ensureResumeBackupsDir();
      await writeFile(
        resumeBackupPath(updated.id, updated.updatedAt.getTime()),
        JSON.stringify(body.content, null, 2),
        "utf8",
      );
      publish(
        resumeChannel,
        { resumeId: updated.id },
        {
          type: "content.updated",
          resumeId: updated.id,
          version: updated.version,
        },
      );
    }

    return { id: updated.id, version: updated.version };
  },
);

export const DELETE = api.route({ params: idParam }, async ({ params, profileId }) => {
  const existing = await findOwned(
    (where) =>
      db.resume.findFirst({
        where,
        select: {
          id: true,
          sourceFilename: true,
          variants: { select: { id: true } },
        },
      }),
    { id: params.id, profileId },
    "Resume",
  );

  await db.profile.updateMany({
    where: { id: profileId, primaryResumeId: params.id },
    data: { primaryResumeId: null },
  });

  await db.resume.delete({ where: { id: params.id } });
  await deleteAllResumeArtifacts({
    resumeId: existing.id,
    sourceFilename: existing.sourceFilename,
    variantIds: existing.variants.map((v) => v.id),
  });

  return { deleted: params.id };
});
