import type { CaptchaType } from "@/api/contracts/captcha";

/** A single CAPTCHA to solve, normalized across providers. */
export interface ProviderJob {
  type: CaptchaType;
  sitekey: string;
  pageurl: string;
}
