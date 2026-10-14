import { randomBytes } from "node:crypto";
import { json, route } from "@/lib/http";
import { authLimiter, clientKey, enforceLimit } from "@/lib/ratelimit";
import { getSession } from "@/lib/session";

export const POST = route(async (request) => {
  await enforceLimit(authLimiter, clientKey(request));
  const session = await getSession();
  const nonce = randomBytes(16).toString("hex");
  session.nonce = nonce;
  await session.save();
  return json({ nonce });
});
