import "server-only";
import { Solver } from "@2captcha/captcha-solver";
import type { ProviderJob } from "./types";

/**
 * Solve via the official `@2captcha/captcha-solver` SDK, which handles task
 * submission, polling, and timeout internally and throws `APIError` on failure.
 */
export async function solveWithTwoCaptcha(apiKey: string, job: ProviderJob): Promise<string> {
  const solver = new Solver(apiKey);
  const { pageurl, sitekey } = job;

  switch (job.type) {
    case "recaptcha":
      return (await solver.recaptcha({ pageurl, googlekey: sitekey })).data;
    case "hcaptcha":
      return (await solver.hcaptcha({ pageurl, sitekey })).data;
    case "turnstile":
      return (await solver.cloudflareTurnstile({ pageurl, sitekey })).data;
  }
}
