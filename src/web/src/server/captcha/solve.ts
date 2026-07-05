import "server-only";
import type { CaptchaSolveResult, CaptchaType } from "@/api/contracts/captcha";
import { SERVICE_PROVIDERS, type ServiceProvider } from "@/api/contracts/credential";
import { notFound } from "@/server/api/errors";
import { db } from "@/server/db";
import { solveWithCapSolver } from "./capsolver";
import { solveWithTwoCaptcha } from "./two-captcha";
import type { ProviderJob } from "./types";

const SOLVERS: Record<ServiceProvider, (apiKey: string, job: ProviderJob) => Promise<string>> = {
  "2captcha": solveWithTwoCaptcha,
  capsolver: solveWithCapSolver,
};

interface SolveArgs {
  profileId: number;
  type: CaptchaType;
  sitekey: string;
  pageurl: string;
  provider?: ServiceProvider;
}

/**
 * Resolve a CAPTCHA via the profile's configured solving service (2captcha / CapSolver)
 * and return the token to inject. Throws 404 when no key is configured, 502 on solver failure.
 */
export async function solveCaptcha({
  profileId,
  type,
  sitekey,
  pageurl,
  provider,
}: SolveArgs): Promise<CaptchaSolveResult> {
  const cred = await resolveServiceCredential(profileId, provider);
  if (!cred) {
    throw notFound(
      "No captcha-solving service key configured. Add a 2captcha or CapSolver key in Settings.",
    );
  }

  const job: ProviderJob = { type, sitekey, pageurl };
  const token = await SOLVERS[cred.provider](cred.apiKey, job);

  return { token, provider: cred.provider };
}

async function resolveServiceCredential(
  profileId: number,
  provider?: ServiceProvider,
): Promise<{ provider: ServiceProvider; apiKey: string } | null> {
  const rows = await db.credential.findMany({
    where: { profileId, scope: { in: [...SERVICE_PROVIDERS] }, NOT: { apiKey: null } },
  });
  // Honor an explicit provider; otherwise fall back in SERVICE_PROVIDERS preference order.
  const order: readonly ServiceProvider[] = provider ? [provider] : SERVICE_PROVIDERS;
  for (const p of order) {
    const row = rows.find((r) => r.scope === p && r.apiKey);
    if (row?.apiKey) {
      return { provider: p, apiKey: row.apiKey };
    }
  }
  return null;
}
