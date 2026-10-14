import { json, route } from "@/lib/http";
import { prepareClaim, requireUser } from "@/lib/game";
import { claimLimiter, clientKey, enforceLimit } from "@/lib/ratelimit";

export const POST = route(async (request) => {
  const address = await requireUser();
  await enforceLimit(claimLimiter, clientKey(request, address));
  return json(await prepareClaim(address));
});
