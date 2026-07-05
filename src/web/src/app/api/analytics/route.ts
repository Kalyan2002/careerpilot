import { computeAnalyticsStats } from "@/server/analytics/stats";
import { api } from "@/server/api/route";

export const GET = api.route({}, ({ profileId }) => computeAnalyticsStats(profileId));
