import { z } from "zod";
import { json, route } from "@/lib/http";
import { authLimiter, clientKey, enforceLimit } from "@/lib/ratelimit";
import { getSession } from "@/lib/session";
import { requestOrigin, verifyBoothSlip } from "@/lib/siwe";
import { GameError } from "@/lib/errors";
import type { Hex } from "viem";

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

export const POST = route(async (request) => {
  await enforceLimit(authLimiter, clientKey(request));
  const body = bodySchema.parse(await request.json());
  const session = await getSession();
  const nonce = session.nonce;
  session.nonce = undefined;
  await session.save();

  if (!nonce) {
    throw new GameError(400, "missing_nonce", "Request a fresh booth slip and sign that.");
  }

  const origin = requestOrigin(request);
  const address = await verifyBoothSlip({
    message: body.message,
    signature: body.signature as Hex,
    nonce,
    domain: origin.domain,
    origin: origin.origin,
    scheme: origin.scheme,
  });

  session.address = address;
  await session.save();
  return json({ address });
});
