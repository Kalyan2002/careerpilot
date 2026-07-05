import { credentialPatchSchema } from "@/api/contracts/credential";
import { idParam } from "@/api/contracts/shared";
import { findOwned } from "@/server/api/owned";
import { api } from "@/server/api/route";
import { db } from "@/server/db";

const findCredential = (id: number, profileId: number) =>
  findOwned(
    (where) => db.credential.findFirst({ where, select: { id: true } }),
    { id, profileId },
    "Credential",
  );

export const PATCH = api.route(
  { params: idParam, body: credentialPatchSchema },
  async ({ params, body, profileId }) => {
    await findCredential(params.id, profileId);
    return db.credential.update({ where: { id: params.id }, data: body });
  },
);

export const DELETE = api.route({ params: idParam }, async ({ params, profileId }) => {
  await findCredential(params.id, profileId);
  await db.credential.delete({ where: { id: params.id } });
  return { deleted: params.id };
});
