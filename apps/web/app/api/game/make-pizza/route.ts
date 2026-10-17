import { RECIPE_IDS } from "@cyberpizza/shared";
import { z } from "zod";
import { json, route } from "@/lib/http";
import { makePizza, requireUser } from "@/lib/game";
import { bakeLimiter, clientKey, enforceLimit } from "@/lib/ratelimit";

const bodySchema = z.object({
  recipeId: z.enum(RECIPE_IDS),
});

export const POST = route(async (request) => {
  const address = await requireUser();
  await enforceLimit(bakeLimiter, clientKey(request, address));
  const body = bodySchema.parse(await request.json());
  return json(await makePizza(address, body.recipeId));
});
