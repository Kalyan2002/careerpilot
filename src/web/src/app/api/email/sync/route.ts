import { api } from "@/server/api/route";
import { syncInbox } from "@/server/email/sync";

export const POST = api.route({}, ({ profileId }) => syncInbox(profileId));
