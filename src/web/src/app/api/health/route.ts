import { api } from "@/server/api/route";

const VERSION = "2.0.0";

export const GET = api.route({ public: true }, () => ({
  version: VERSION,
  time: new Date().toISOString(),
}));
