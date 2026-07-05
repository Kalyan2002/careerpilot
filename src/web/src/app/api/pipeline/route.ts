import { z } from "zod/v4";
import { PIPELINE_STAGES } from "@/api/types/pipeline";
import { api } from "@/server/api/route";
import {
  loadApplying,
  loadInterviewing,
  loadQueued,
  loadSubmitted,
} from "@/server/pipeline/loaders";

const filter = z.string().trim().min(1).nullish().catch(null);

const pipelineQuery = z.object({
  stage: z.enum(PIPELINE_STAGES),
  cursor: z.coerce.number().int().positive().nullish().catch(null),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .catch(50)
    .transform((n) => Math.min(n, 200)),
  search: filter,
  board: filter,
  campaignId: filter,
});

export const GET = api.route({ query: pipelineQuery }, ({ query, profileId }) => {
  const { stage, limit } = query;
  const cursor = query.cursor ?? null;
  const filters = {
    search: query.search ?? null,
    board: query.board ?? null,
    campaignId: query.campaignId ?? null,
  };

  switch (stage) {
    case "queued":
      return loadQueued(profileId, cursor, limit, filters);
    case "applying":
      return loadApplying(profileId, cursor, limit, filters);
    case "submitted":
      return loadSubmitted(profileId, cursor, limit, filters);
    case "interviewing":
      return loadInterviewing(profileId, cursor, limit, filters);
  }
});
