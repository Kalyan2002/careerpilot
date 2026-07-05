import { upworkChannel } from "@/lib/sse/channels/upwork";
import { sseResponse, subscribe } from "@/lib/sse/server";
import { getActiveProfileId } from "@/server/active-profile";

export async function GET() {
  const profileId = await getActiveProfileId();
  return sseResponse(subscribe(upworkChannel, { profileId }));
}
