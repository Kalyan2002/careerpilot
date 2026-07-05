import { coverLetterCreateSchema } from "@/api/contracts/cover-letter";
import { api } from "@/server/api/route";
import { createCoverLetter, listCoverLetters } from "@/server/cover-letters/service";

/** List the active profile's saved cover letters (newest first). */
export const GET = api.route({}, ({ profileId }) => listCoverLetters(profileId));

export const POST = api.route({ body: coverLetterCreateSchema }, ({ body, profileId }) =>
  createCoverLetter(profileId, body),
);
