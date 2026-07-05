import { credentialSchema } from "@/api/contracts/credential";
import { api } from "@/server/api/route";
import { db } from "@/server/db";

export const GET = api.route({}, ({ profileId }) =>
  db.credential.findMany({ where: { profileId }, orderBy: { scope: "asc" } }),
);

export const POST = api.route({ body: credentialSchema }, ({ body, profileId }) =>
  db.credential.create({ data: { ...body, profileId } }),
);
