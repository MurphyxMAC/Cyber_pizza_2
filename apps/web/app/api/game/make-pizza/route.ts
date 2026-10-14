import { json, route } from "@/lib/http";
import { makePizza, requireUser } from "@/lib/game";
import { bakeLimiter, clientKey, enforceLimit } from "@/lib/ratelimit";

export const POST = route(async (request) => {
  const address = await requireUser();
  await enforceLimit(bakeLimiter, clientKey(request, address));
  return json(await makePizza(address));
});
