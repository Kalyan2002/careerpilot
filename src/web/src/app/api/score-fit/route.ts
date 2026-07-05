import { z } from "zod/v4";
import { api } from "@/server/api/route";
import { fitProfileSchema, jobDigestSchema } from "@/server/scoring/fit";
import { scoreJobFit } from "@/server/scoring/profile-fit";

const requestSchema = z.object({
  digest: jobDigestSchema,
  profile: fitProfileSchema.partial().optional(),
});

export const POST = api.route({ body: requestSchema }, ({ body, profileId }) =>
  scoreJobFit({ profileId, digest: body.digest, profile: body.profile }),
);
