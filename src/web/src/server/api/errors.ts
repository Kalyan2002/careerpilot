import "server-only";
import { ErrorCodes } from "@/server/api/response";

/**
 * An error carrying the HTTP status + envelope code it should map to.
 * Thrown anywhere inside a route handler (or a service it calls); the kernel
 * in `route.ts` catches it and shapes the `{ ok: false, error }` response.
 */
export class HttpError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function notFound(message = "Not found"): HttpError {
  return new HttpError(ErrorCodes.NOT_FOUND, message, 404);
}

export function conflict(message: string): HttpError {
  return new HttpError(ErrorCodes.CONFLICT, message, 409);
}

export function badRequest(message: string): HttpError {
  return new HttpError(ErrorCodes.INVALID_REQUEST, message, 400);
}
