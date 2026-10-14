import { INGREDIENT_IDS } from "@cyberpizza/shared";
import { z } from "zod";
import { json, route } from "@/lib/http";
import { collectIngredient, requireUser } from "@/lib/game";
import { clientKey, collectLimiter, enforceLimit } from "@/lib/ratelimit";

const bodySchema = z.object({
  ingredient: z.enum(INGREDIENT_IDS),
});

export const POST = route(async (request) => {
  const address = await requireUser();
  await enforceLimit(collectLimiter, clientKey(request, address));
  const body = bodySchema.parse(await request.json());
  return json(await collectIngredient(address, body.ingredient));
});
