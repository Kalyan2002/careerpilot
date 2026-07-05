import "server-only";
import type { CaptchaType } from "@/api/contracts/captcha";
import { HttpError } from "@/server/api/errors";
import { ErrorCodes } from "@/server/api/response";
import { sleep } from "@/utils/async";
import type { ProviderJob } from "./types";

const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 24; // ~120s budget

/** 502 — the upstream solver failed or timed out. */
function serviceError(message: string): HttpError {
  return new HttpError(ErrorCodes.INTERNAL, message, 502);
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  if (!res.ok) {
    throw serviceError(`CapSolver responded HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

const CAPSOLVER_TASK: Record<CaptchaType, string> = {
  recaptcha: "ReCaptchaV2TaskProxyLess",
  hcaptcha: "HCaptchaTaskProxyLess",
  turnstile: "AntiTurnstileTaskProxyLess",
};

interface CapSolverResponse {
  errorId: number;
  errorDescription?: string;
  status?: string;
  taskId?: string;
  solution?: { gRecaptchaResponse?: string; token?: string };
}

function post(
  apiKey: string,
  path: string,
  extra: Record<string, unknown>,
): Promise<CapSolverResponse> {
  return fetchJson<CapSolverResponse>(`https://api.capsolver.com/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientKey: apiKey, ...extra }),
  });
}

/**
 * CapSolver has no official Node SDK (REST-only, per docs.capsolver.com) — this
 * is a minimal typed client: create a task, then poll until it's ready.
 */
export async function solveWithCapSolver(apiKey: string, job: ProviderJob): Promise<string> {
  const created = await post(apiKey, "createTask", {
    task: { type: CAPSOLVER_TASK[job.type], websiteURL: job.pageurl, websiteKey: job.sitekey },
  });
  if (created.errorId !== 0 || !created.taskId) {
    throw serviceError(`CapSolver createTask failed: ${created.errorDescription ?? "unknown"}`);
  }

  const { taskId } = created;
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);

    const res = await post(apiKey, "getTaskResult", { taskId });
    if (res.errorId !== 0) {
      throw serviceError(`CapSolver error: ${res.errorDescription ?? "unknown"}`);
    }

    if (res.status === "ready") {
      const token = res.solution?.gRecaptchaResponse ?? res.solution?.token;
      if (!token) {
        throw serviceError("CapSolver returned no token");
      }
      return token;
    }
  }
  throw serviceError("CapSolver timed out");
}
