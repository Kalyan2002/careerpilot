import { z } from "zod/v4";
import type { DuplicateCheckResult } from "@/api/types";
import { api } from "@/server/api/route";
import { db } from "@/server/db";
import {
  APPLIED_DUPLICATE_THRESHOLD,
  APPLIED_DUPLICATE_WINDOW_DAYS,
  findFuzzyDuplicate,
} from "@/server/scoring/applied-duplicates";

const querySchema = z.object({
  url: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  company: z.string().trim().min(1).optional(),
});

export const GET = api.route({ query: querySchema }, async ({ query, profileId }) => {
  const targetUrl = query.url;
  const title = query.title;
  const company = query.company;

  if (targetUrl) {
    const exact = await db.application.findUnique({
      where: { profileId_url: { profileId, url: targetUrl } },
    });
    if (exact) {
      const result: DuplicateCheckResult = {
        applied: true,
        match: {
          kind: "url",
          application: {
            id: exact.id,
            url: exact.url,
            title: exact.title,
            company: exact.company,
            appliedAt: exact.appliedAt.toISOString(),
            stage: exact.stage as DuplicateCheckResult["match"] extends infer M
              ? M extends { application: { stage: infer S } }
                ? S
                : never
              : never,
          },
        },
      };
      return result;
    }
  }

  if (title && company) {
    const cutoff = new Date(Date.now() - APPLIED_DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const candidates = await db.application.findMany({
      where: { profileId, appliedAt: { gte: cutoff } },
      select: {
        id: true,
        url: true,
        title: true,
        company: true,
        appliedAt: true,
        stage: true,
      },
      take: 1000,
    });

    const fuzzy = findFuzzyDuplicate(
      { title, company },
      candidates.map((c) => ({
        id: c.id,
        url: c.url,
        title: c.title,
        company: c.company,
        appliedAt: c.appliedAt,
      })),
      APPLIED_DUPLICATE_THRESHOLD,
    );

    if (fuzzy) {
      const matched = candidates.find((c) => c.id === fuzzy.candidate.id)!;
      const result: DuplicateCheckResult = {
        applied: true,
        match: {
          kind: "fuzzy",
          score: fuzzy.score,
          application: {
            id: matched.id,
            url: matched.url,
            title: matched.title,
            company: matched.company,
            appliedAt: matched.appliedAt.toISOString(),
            stage: matched.stage as DuplicateCheckResult["match"] extends infer M
              ? M extends { application: { stage: infer S } }
                ? S
                : never
              : never,
          },
        },
      };
      return result;
    }
  }

  const empty: DuplicateCheckResult = { applied: false, match: null };
  return empty;
});
