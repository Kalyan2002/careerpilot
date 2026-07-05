/**
 * Neutral API envelope types — shared by the server route toolkit and the
 * client fetch wrapper. Pure types only: no runtime, no `next/server`, no
 * `"use client"` / `"server-only"` directive, so either side can import it
 * without pulling server code into the client bundle.
 */

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string; details?: unknown } };
export type ApiResponse<T> = ApiOk<T> | ApiErr;
