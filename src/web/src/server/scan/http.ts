/**
 * Ported from career-ops's providers/_http.mjs — shared fetch-with-timeout
 * helper used by the zero-token ATS scanning providers.
 */

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_USER_AGENT = "Mozilla/5.0 (compatible; careerpilot/0.1)";

export class HttpFetchError extends Error {
  status?: number;
  body?: string;
}

export interface FetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  method?: string;
  body?: string | null;
  redirect?: RequestRedirect;
}

async function fetchWithTimeout(url: string, opts: FetchOptions = {}): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers = {},
    method = "GET",
    body = null,
    redirect = "follow",
  } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { "user-agent": DEFAULT_USER_AGENT, ...headers },
      body,
      redirect,
      signal: controller.signal,
    });
    if (!res.ok) {
      const responseText = await res.text().catch(() => "");
      const snippet = responseText.replace(/\s+/g, " ").trim().slice(0, 300);
      const err = new HttpFetchError(snippet ? `HTTP ${res.status}: ${snippet}` : `HTTP ${res.status}`);
      err.status = res.status;
      err.body = responseText;
      throw err;
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url: string, opts: FetchOptions = {}): Promise<unknown> {
  const res = await fetchWithTimeout(url, opts);
  return res.json();
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const res = await fetchWithTimeout(url, opts);
  return res.text();
}
