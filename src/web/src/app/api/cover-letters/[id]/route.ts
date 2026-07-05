import { idParam } from "@/api/contracts/shared";
import { api } from "@/server/api/route";
import { deleteCoverLetter, getCoverLetter } from "@/server/cover-letters/service";

export const GET = api.route({ params: idParam }, ({ params, profileId }) =>
  getCoverLetter(params.id, profileId),
);

export const DELETE = api.route({ params: idParam }, async ({ params, profileId }) => {
  await deleteCoverLetter(params.id, profileId);
  return { ok: true };
});
