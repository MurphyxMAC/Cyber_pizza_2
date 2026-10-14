import { z } from "zod";
import { json, route } from "@/lib/http";
import { confirmClaim } from "@/lib/confirm";
import { requireUser } from "@/lib/game";
import { claimLimiter, clientKey, enforceLimit } from "@/lib/ratelimit";
import type { Hex } from "viem";

const bodySchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export const POST = route(async (request) => {
  const address = await requireUser();
  await enforceLimit(claimLimiter, clientKey(request, address));
  const body = bodySchema.parse(await request.json());
  return json(await confirmClaim(address, body.txHash as Hex));
});
