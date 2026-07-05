import { profileWithAutoApplySchema } from "@/api/contracts/profile";
import { api } from "@/server/api/route";
import { db } from "@/server/db";

export const GET = api.route({ public: true }, () =>
  db.profile.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
    },
  }),
);

export const POST = api.route(
  { public: true, body: profileWithAutoApplySchema.partial() },
  async ({ body }) => {
    const { autoApply, preferredLocations, primaryResumeId, ...profileFields } = body;
    const hasActive = await db.profile.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    const profile = await db.profile.create({
      data: {
        firstName: profileFields.firstName ?? "",
        lastName: profileFields.lastName ?? "",
        email: profileFields.email ?? "",
        phone: profileFields.phone ?? null,
        website: profileFields.website ?? null,
        linkedin: profileFields.linkedin ?? null,
        github: profileFields.github ?? null,
        street: profileFields.street ?? null,
        aptUnit: profileFields.aptUnit ?? null,
        city: profileFields.city ?? null,
        state: profileFields.state ?? null,
        zipCode: profileFields.zipCode ?? null,
        country: profileFields.country ?? null,
        usAuthorized: profileFields.usAuthorized ?? false,
        requiresSponsorship: profileFields.requiresSponsorship ?? false,
        visaStatus: profileFields.visaStatus ?? null,
        optExtension: profileFields.optExtension ?? null,
        willingToRelocate: profileFields.willingToRelocate ?? false,
        preferredLocations: JSON.stringify(preferredLocations ?? []),
        eeoGender: profileFields.eeoGender ?? null,
        eeoRace: profileFields.eeoRace ?? null,
        eeoEthnicity: profileFields.eeoEthnicity ?? null,
        eeoHispanicOrLatino: profileFields.eeoHispanicOrLatino ?? null,
        eeoVeteranStatus: profileFields.eeoVeteranStatus ?? null,
        eeoDisabilityStatus: profileFields.eeoDisabilityStatus ?? null,
        primaryResumeId: primaryResumeId ?? null,
        isActive: !hasActive,
        autoApply: { create: autoApply ?? {} },
      },
    });

    return { id: profile.id };
  },
);
