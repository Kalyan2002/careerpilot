import { NextResponse, type NextRequest } from "next/server";
import type { ProfileResponse } from "@/api/types";
import { apiGet } from "@/server/api/fetch";
import { isProfileEmpty } from "@/utils/profile";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { data } = await apiGet<ProfileResponse>("/api/profile", request);

  if (data === null || data.profile === null || isProfileEmpty(data.profile)) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|onboarding|favicon.ico|.*\\..*).*)"],
};
