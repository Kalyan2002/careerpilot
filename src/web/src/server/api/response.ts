import { NextResponse } from "next/server";
import type { ApiErr, ApiOk } from "@/api/envelope";

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiOk<T>> {
  return NextResponse.json({ ok: true, data }, init);
}

export function err(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
): NextResponse<ApiErr> {
  return NextResponse.json({ ok: false, error: { code, message, details } }, { status });
}

export const ErrorCodes = {
  INVALID_REQUEST: "INVALID_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  UNPROCESSABLE: "UNPROCESSABLE_ENTITY",
  INTERNAL: "INTERNAL_ERROR",
} as const;
