import { z } from "zod/v4";
import { idParam } from "@/api/contracts/shared";
import { api } from "@/server/api/route";
import { createTailoredVariant } from "@/server/resumes/variant";

const tailorRequestSchema = z.object({
  label: z.string().min(1),
  jobUrl: z.url().optional().nullable(),
  applicationId: z.number().int().positive().optional().nullable(),
  summary: z.string().optional(),
  emphasizedTech: z.array(z.string()).optional(),
  jobKeywords: z.array(z.string()).optional(),
  diffNotes: z.string().optional().nullable(),
  maxBulletsPerEntry: z.number().int().min(1).max(20).optional(),
  rewordTopN: z.number().int().min(0).max(3).optional(),
  bulletRewrites: z
    .array(
      z.object({
        entryIndex: z.number().int().min(0),
        bullets: z
          .array(z.object({ original: z.string().min(1), tailored: z.string().min(1) }))
          .min(1),
      }),
    )
    .optional(),
});

export const POST = api.route(
  { params: idParam, body: tailorRequestSchema },
  ({ params: { id: resumeId }, body, profileId }) =>
    createTailoredVariant({ resumeId, profileId, body }),
);
