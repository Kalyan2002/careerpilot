import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { Prisma } from "@/generated/prisma/client";
import { getActiveProfileId } from "@/server/active-profile";
import { err, ErrorCodes, ok } from "@/server/api/response";
import { HttpError } from "./errors";

/** Shape Next.js passes as the second handler argument for any route segment. */
interface RouteContext {
  params: Promise<Record<string, string>>;
}

interface RouteConfig<P, Q, B> {
  params?: z.ZodType<P>;
  query?: z.ZodType<Q>;
  body?: z.ZodType<B>;
  /** Success status override. Defaults to 200. */
  status?: number;
}

type ProfileRouteConfig<P, Q, B> = RouteConfig<P, Q, B> & {
  public?: false;
};

type PublicRouteConfig<P, Q, B> = RouteConfig<P, Q, B> & {
  public: true;
};

type AnyRouteConfig<P, Q, B> = RouteConfig<P, Q, B> & {
  public?: boolean;
};

interface BaseCtx<P, Q, B> {
  req: NextRequest;
  params: P;
  query: Q;
  body: B;
}

interface ProfileCtx<P, Q, B> extends BaseCtx<P, Q, B> {
  profileId: number;
}

type Handler<Ctx> = (ctx: Ctx) => Promise<unknown> | unknown;
type RouteHandler = (req: NextRequest, ctx: RouteContext) => Promise<Response>;

function route<P = undefined, Q = undefined, B = undefined>(
  config: PublicRouteConfig<P, Q, B>,
  handler: Handler<BaseCtx<P, Q, B>>,
): RouteHandler;

function route<P = undefined, Q = undefined, B = undefined>(
  config: ProfileRouteConfig<P, Q, B>,
  handler: Handler<ProfileCtx<P, Q, B>>,
): RouteHandler;

function route<P, Q, B>(
  config: AnyRouteConfig<P, Q, B>,
  handler: Handler<BaseCtx<P, Q, B>> | Handler<ProfileCtx<P, Q, B>>,
): RouteHandler {
  return createRoute(
    config,
    handler as Handler<BaseCtx<P, Q, B> & { profileId?: number }>,
    config.public !== true,
  );
}

function createRoute<P, Q, B>(
  config: RouteConfig<P, Q, B>,
  handler: Handler<BaseCtx<P, Q, B> & { profileId?: number }>,
  withProfile: boolean,
): RouteHandler {
  return async (req, routeCtx) => {
    try {
      const params = (config.params ? config.params.parse(await routeCtx.params) : undefined) as P;
      const query = (config.query ? config.query.parse(queryObject(req)) : undefined) as Q;
      const body = (config.body ? config.body.parse(await req.json()) : undefined) as B;
      const profileId = withProfile ? await getActiveProfileId() : undefined;

      const data = await handler({ req, params, query, body, profileId });
      if (data instanceof Response) {
        return data;
      }
      return ok(data, config.status ? { status: config.status } : undefined);
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}

function queryObject(req: NextRequest): Record<string, string> {
  // Last-value-wins. No current route reads array-valued query params; a future
  // one that needs `getAll` must parse `req.nextUrl.searchParams` itself.
  return Object.fromEntries(new URL(req.url).searchParams);
}

function toErrorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    return err(e.code, e.message, e.status, e.details);
  }
  if (e instanceof z.ZodError) {
    return err(ErrorCodes.UNPROCESSABLE, "Invalid request", 422, e.issues);
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return err(ErrorCodes.CONFLICT, "Already exists", 409);
  }

  // Unknown error: keep the JSON envelope contract (skills/curl depend on it)
  // rather than letting Next serve an HTML/dev error page.
  console.error("Unhandled API error:", e);
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal error"
      : e instanceof Error
        ? e.message
        : String(e);
  return err(ErrorCodes.INTERNAL, message, 500);
}

/**
 * Typed route kernel. Handlers declare Zod contracts and return plain data
 * (auto-wrapped in the `ok` envelope) or a raw `Response` (passed through —
 * the escape hatch for SSE streams, file downloads, redirects, cookies).
 */
export const api = {
  route,
};
