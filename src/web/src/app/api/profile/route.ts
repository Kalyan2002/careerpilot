import { profileWithAutoApplySchema } from "@/api/contracts/profile";
import { getActiveProfileIdOrNull } from "@/server/active-profile";
import { HttpError } from "@/server/api/errors";
import { ErrorCodes } from "@/server/api/response";
import { api } from "@/server/api/route";
import { db } from "@/server/db";
import { resumePath } from "@/server/storage";

const PROFILE_SCALAR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  website: true,
  linkedin: true,
  github: true,
  street: true,
  aptUnit: true,
  city: true,
  state: true,
  zipCode: true,
  country: true,
  usAuthorized: true,
  requiresSponsorship: true,
  visaStatus: true,
  optExtension: true,
  willingToRelocate: true,
  preferredLocations: true,
  eeoGender: true,
  eeoRace: true,
  eeoEthnicity: true,
  eeoHispanicOrLatino: true,
  eeoVeteranStatus: true,
  eeoDisabilityStatus: true,
  primaryResumeId: true,
  updatedAt: true,
} as const;

const EMPTY_PROFILE = {
  profile: null,
  autoApply: null,
  primaryResumeSourceAbsolutePath: null,
  resumes: [],
};

export const GET = api.route({ public: true }, async () => {
  const id = await getActiveProfileIdOrNull();
  if (id === null) {
    return EMPTY_PROFILE;
  }

  const profile = await db.profile.findUnique({
    where: { id },
    select: PROFILE_SCALAR_SELECT,
  });

  if (!profile) {
    return EMPTY_PROFILE;
  }

  const [autoApply, primarySource, resumeRows, withContent, references] = await Promise.all([
    db.autoApplySettings.findUnique({ where: { profileId: id } }),
    profile.primaryResumeId
      ? db.resume.findUnique({
          where: { id: profile.primaryResumeId },
          select: { sourceFilename: true },
        })
      : Promise.resolve(null),
    db.resume.findMany({
      where: { profileId: id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        label: true,
        sourceFilename: true,
        updatedAt: true,
        _count: { select: { variants: true } },
      },
    }),
    db.resume.findMany({
      where: { profileId: id, content: { not: null } },
      select: { id: true },
    }),
    db.reference.findMany({
      where: { profileId: id },
      orderBy: { position: "asc" },
      select: { id: true, name: true, relationship: true, company: true, email: true, phone: true },
    }),
  ]);

  const hasContentIds = new Set(withContent.map((r) => r.id));
  const resumes = resumeRows.map((r) => ({
    id: r.id,
    label: r.label,
    sourceFilename: r.sourceFilename,
    hasData: hasContentIds.has(r.id),
    variantCount: r._count.variants,
    isPrimary: r.id === profile.primaryResumeId,
    updatedAt: r.updatedAt.toISOString(),
  }));

  return {
    profile: {
      ...profile,
      preferredLocations: JSON.parse(profile.preferredLocations) as string[],
      references,
      updatedAt: profile.updatedAt.toISOString(),
    },
    autoApply,
    primaryResumeSourceAbsolutePath: primarySource?.sourceFilename
      ? resumePath(primarySource.sourceFilename)
      : null,
    resumes,
  };
});

export const PUT = api.route(
  { public: true, body: profileWithAutoApplySchema },
  async ({ body }) => {
    const id = await getActiveProfileIdOrNull();
    if (id === null) {
      throw new HttpError(
        ErrorCodes.UNPROCESSABLE,
        "No active profile. Create one via POST /api/profiles.",
        422,
      );
    }

    const { autoApply, preferredLocations, primaryResumeId, references, ...profileFields } = body;
    const preferredLocationsJson = JSON.stringify(preferredLocations);

    await db.profile.update({
      where: { id },
      data: {
        ...profileFields,
        preferredLocations: preferredLocationsJson,
        primaryResumeId: primaryResumeId ?? null,
      },
    });

    // Replace the reference set wholesale — the settings form submits the full list.
    await db.$transaction([
      db.reference.deleteMany({ where: { profileId: id } }),
      db.reference.createMany({
        data: references.map((r, i) => ({
          profileId: id,
          name: r.name,
          relationship: r.relationship ?? null,
          company: r.company ?? null,
          email: r.email ?? null,
          phone: r.phone ?? null,
          position: i,
        })),
      }),
    ]);

    if (autoApply) {
      await db.autoApplySettings.upsert({
        where: { profileId: id },
        create: { profileId: id, ...autoApply },
        update: autoApply,
      });
    }

    return { id };
  },
);
