import { resumeVariantPatchSchema } from "@/api/contracts/resume";
import { idParam } from "@/api/contracts/shared";
import type { ResumeVariantDto } from "@/api/types";
import { findOwned } from "@/server/api/owned";
import { api } from "@/server/api/route";
import { db } from "@/server/db";

const findVariant = (id: number, profileId: number) =>
  findOwned(
    (where) =>
      db.resumeVariant.findFirst({
        where,
        include: { resume: { select: { label: true } } },
      }),
    { id, resume: { profileId } },
    "Variant",
  );

export const GET = api.route({ params: idParam }, async ({ params, profileId }) => {
  const variant = await findVariant(params.id, profileId);

  const dto: ResumeVariantDto = {
    id: variant.id,
    resumeId: variant.resumeId,
    resumeLabel: variant.resume.label,
    label: variant.label,
    jobUrl: variant.jobUrl,
    applicationId: variant.applicationId,
    content: JSON.parse(variant.content),
    diffNotes: variant.diffNotes,
    rewrites: variant.rewrites ? JSON.parse(variant.rewrites) : null,
    createdAt: variant.createdAt.toISOString(),
    updatedAt: variant.updatedAt.toISOString(),
  };
  return dto;
});

export const PATCH = api.route(
  { params: idParam, body: resumeVariantPatchSchema },
  async ({ params, body, profileId }) => {
    await findVariant(params.id, profileId);

    const updated = await db.resumeVariant.update({
      where: { id: params.id },
      data: {
        label: body.label ?? undefined,
        jobUrl: body.jobUrl === undefined ? undefined : body.jobUrl,
        applicationId: body.applicationId === undefined ? undefined : body.applicationId,
        content: body.content ? JSON.stringify(body.content) : undefined,
        diffNotes: body.diffNotes === undefined ? undefined : body.diffNotes,
      },
    });
    return { id: updated.id };
  },
);

export const DELETE = api.route({ params: idParam }, async ({ params, profileId }) => {
  await findVariant(params.id, profileId);

  await db.resumeVariant.delete({ where: { id: params.id } });
  return { deleted: params.id };
});
