import { approveSchema } from "@/api/contracts/email";
import { idParam } from "@/api/contracts/shared";
import { api } from "@/server/api/route";
import { approveEmailReply } from "@/server/email/approve";

export const POST = api.route(
  { params: idParam, body: approveSchema },
  ({ params: { id }, body, profileId }) => approveEmailReply({ messageId: id, profileId, body }),
);
