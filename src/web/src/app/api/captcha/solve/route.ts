import { captchaSolveSchema } from "@/api/contracts/captcha";
import { api } from "@/server/api/route";
import { solveCaptcha } from "@/server/captcha/solve";

export const POST = api.route({ body: captchaSolveSchema }, ({ body, profileId }) =>
  solveCaptcha({ profileId, ...body }),
);
