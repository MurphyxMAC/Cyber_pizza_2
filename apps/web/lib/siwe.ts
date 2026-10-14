import { FUJI_CHAIN_ID, SIWE_STATEMENT } from "@cyberpizza/shared";
import { getAddress, verifyMessage, type Hex } from "viem";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { GameError } from "./errors";

const MAX_AGE_MS = 10 * 60 * 1000;

export function requestOrigin(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) {
    throw new GameError(400, "bad_request", "Missing host header.");
  }
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto =
    forwardedProto ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return { domain: host, origin: `${proto}://${host}`, scheme: proto };
}

export async function verifyBoothSlip(input: {
  message: string;
  signature: Hex;
  nonce: string;
  domain: string;
  origin: string;
  scheme: string;
}) {
  const fields = parseSiweMessage(input.message);
  const validFields = validateSiweMessage({
    message: fields,
    nonce: input.nonce,
    domain: input.domain,
    scheme: input.scheme,
  });

  if (!validFields || !fields.address || fields.version !== "1") {
    throw new GameError(401, "invalid_siwe", "That booth slip is not valid.");
  }
  if (fields.chainId !== FUJI_CHAIN_ID) {
    throw new GameError(401, "wrong_chain", "Sign in on Avalanche Fuji (chain 43113).");
  }
  if (fields.statement !== SIWE_STATEMENT) {
    throw new GameError(401, "invalid_siwe", "That booth slip is not for this kitchen.");
  }
  if (!fields.uri || (fields.uri !== input.origin && !fields.uri.startsWith(`${input.origin}/`))) {
    throw new GameError(401, "invalid_siwe", "That booth slip was issued for a different site.");
  }
  if (!fields.issuedAt || Number.isNaN(fields.issuedAt.getTime())) {
    throw new GameError(401, "invalid_siwe", "That booth slip has no issue time.");
  }
  if (Math.abs(Date.now() - fields.issuedAt.getTime()) > MAX_AGE_MS) {
    throw new GameError(401, "invalid_siwe", "That booth slip is too old. Request a new one.");
  }
  if (!fields.expirationTime || fields.expirationTime.getTime() - Date.now() > MAX_AGE_MS) {
    throw new GameError(401, "invalid_siwe", "That booth slip expires too far in the future.");
  }

  const address = getAddress(fields.address);
  const ok = await verifyMessage({
    address,
    message: input.message,
    signature: input.signature,
  });
  if (!ok) {
    throw new GameError(401, "invalid_signature", "The wallet signature does not match the slip.");
  }

  return address.toLowerCase();
}
