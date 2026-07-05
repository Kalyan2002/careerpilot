import "server-only";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

interface ApiOk<T> {
  data: T;
  status: number;
}

interface ApiNotFound {
  data: null;
  status: 404;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8000";

async function readCookieHeader(request?: NextRequest): Promise<string> {
  if (request) {
    return request.headers.get("cookie") ?? "";
  }
  const jar = await cookies();
  return jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

/** Server-side GET against the app's own API. Pass `request` from `proxy.ts`; omit elsewhere. 404 returns `{ data: null }`; other errors throw. */
export async function apiGet<T>(
  path: string,
  request?: NextRequest,
): Promise<ApiOk<T> | ApiNotFound> {
  const cookie = await readCookieHeader(request);

  const res = await fetch(`${APP_URL}${path}`, {
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });

  if (res.status === 404) {
    return { data: null, status: 404 };
  }
  if (!res.ok) {
    throw new Error(`API ${path} failed with status ${res.status}`);
  }

  const body = (await res.json()) as { data: T };
  return { data: body.data, status: res.status };
}
