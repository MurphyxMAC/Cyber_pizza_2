import { json, route } from "@/lib/http";
import { clientKey, enforceLimit, stateLimiter } from "@/lib/ratelimit";
import { ensureUser, getGameState, requireUser } from "@/lib/game";

export const GET = route(async (request) => {
  const address = await requireUser();
  await enforceLimit(stateLimiter, clientKey(request, address));
  await ensureUser(address);
  return json(await getGameState(address));
});
