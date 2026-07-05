import { resumeVariantCreateSchema } from "@/api/contracts/resume";
import { idParam } from "@/api/contracts/shared";
import type { ResumeVariantListItem } from "@/api/types";
import { notFound } from "@/server/api/errors";
import { findOwned } from "@/server/api/owned";
import { api } from "@/server/api/route";
import { db } from "@/server/db";

export const GET = api.route({ params: idParam }, async ({ params, profileId }) => {
  await findOwned(
    (where) => db.resume.findFirst({ where, select: { id: true } }),
    { id: params.id, profileId },
    "Resume",
  );

  const variants = await db.resumeVariant.findMany({
    where: { resumeId: params.id },
    orderBy: { updatedAt: "desc" },
  });

  const items: ResumeVariantListItem[] = variants.map((v) => ({
    id: v.id,
    resumeId: v.resumeId,
    label: v.label,
    jobUrl: v.jobUrl,
    applicationId: v.applicationId,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  }));
  return items;
});

export const POST = api.route(
  { params: idParam, body: resumeVariantCreateSchema },
  async ({ params, body, profileId }) => {
    await findOwned(
      (where) => db.resume.findFirst({ where, select: { id: true } }),
      { id: params.id, profileId },
      "Resume",
    );

    if (body.applicationId) {
      const app = await db.application.findUnique({
        where: { id: body.applicationId },
        select: { id: true },
      });
      if (!app) {
        throw notFound("Application not found");
      }
    }

    const variant = await db.resumeVariant.create({
      data: {
        resumeId: params.id,
        label: body.label,
        jobUrl: body.jobUrl ?? null,
        applicationId: body.applicationId ?? null,
        content: JSON.stringify(body.content),
        diffNotes: body.diffNotes ?? null,
      },
    });

    return { id: variant.id };
  },
);
