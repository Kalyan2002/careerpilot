import { z } from "zod/v4";
import type { Prisma } from "@/generated/prisma/client";
import { api } from "@/server/api/route";
import { db } from "@/server/db";

const querySchema = z.object({
  reviewStatus: z.string().optional(),
  classification: z.string().optional(),
  since: z.string().optional(),
  domainHint: z.string().optional(),
  verificationDomain: z.string().optional(),
});

export const GET = api.route({ query: querySchema }, ({ query, profileId }) => {
  const { reviewStatus, classification, since, domainHint, verificationDomain } = query;

  const where: Prisma.EmailMessageWhereInput = { account: { profileId } };

  if (reviewStatus) {
    where.reviewStatus = reviewStatus;
  }
  if (classification === "null") {
    where.classification = null;
  } else if (classification) {
    where.classification = classification;
  }
  if (since) {
    const date = new Date(since);
    if (!Number.isNaN(date.getTime())) where.receivedAt = { gte: date };
  }
  if (verificationDomain) {
    where.verificationDomain = verificationDomain;
  }
  if (domainHint) {
    where.OR = [
      { fromDomain: { contains: domainHint } },
      { subject: { contains: domainHint } },
      { rawBody: { contains: domainHint } },
    ];
  }

  return db.emailMessage.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    take: 200,
    include: {
      matchedApp: { select: { id: true, title: true, company: true, stage: true } },
    },
  });
});
