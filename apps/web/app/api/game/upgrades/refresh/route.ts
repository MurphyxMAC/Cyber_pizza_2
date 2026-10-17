import { json, route } from "@/lib/http";
import { getGameState, requireUser } from "@/lib/game";
import { clientKey, enforceLimit, upgradeLimiter } from "@/lib/ratelimit";
import { refreshUpgradeLevels } from "@/lib/upgrades";

export const POST = route(async (request) => {
  const address = await requireUser();
  await enforceLimit(upgradeLimiter, clientKey(request, address));
  await refreshUpgradeLevels(address);
  return json(await getGameState(address));
});
