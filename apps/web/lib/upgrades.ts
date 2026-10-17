import {
  INGREDIENTS,
  UPGRADE_LEVEL_CACHE_MS,
  UPGRADE_MAX_LEVEL,
  upgradesAbi,
} from "@cyberpizza/shared";
import { getAddress } from "viem";
import { fujiClient } from "./chain";
import { getContracts } from "./contracts";
import { GameError } from "./errors";

const FAIL_CACHE_MS = 5_000;
const CACHE_LIMIT = 2_000;

type CacheEntry = { at: number; levels: number[] | null };

const cache = new Map<string, CacheEntry>();

function zeros() {
  return Array<number>(INGREDIENTS.length).fill(0);
}

function remember(key: string, entry: CacheEntry) {
  cache.delete(key);
  cache.set(key, entry);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

function clampLevels(values: readonly unknown[]) {
  if (values.length !== INGREDIENTS.length) return null;
  const levels: number[] = [];
  for (const value of values) {
    const level = typeof value === "bigint" ? Number(value) : Number(value);
    if (!Number.isInteger(level) || level < 0) return null;
    levels.push(Math.min(UPGRADE_MAX_LEVEL, level));
  }
  return levels;
}

async function readLevels(address: string) {
  const contracts = getContracts();
  if (!contracts.upgradesDeployed) return zeros();

  const result = await fujiClient().readContract({
    address: getAddress(contracts.upgrades),
    abi: upgradesAbi,
    functionName: "levelsOf",
    args: [getAddress(address)],
  });
  const levels = clampLevels(result);
  if (!levels) {
    throw new Error("Upgrades.levelsOf returned an unexpected value.");
  }
  return levels;
}

/**
 * Levels for the session address, from Upgrades.levelsOf.
 * A successful read is reused for UPGRADE_LEVEL_CACHE_MS. Client-supplied levels are never accepted.
 * A failed read keeps the last good snapshot, or level 0 when there is none (longer cooldowns).
 */
export async function getUpgradeLevels(address: string) {
  const contracts = getContracts();
  if (!contracts.upgradesDeployed) return zeros();

  const key = address.toLowerCase();
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < (hit.levels ? UPGRADE_LEVEL_CACHE_MS : FAIL_CACHE_MS)) {
    return hit.levels ? [...hit.levels] : zeros();
  }

  try {
    const levels = await readLevels(address);
    remember(key, { at: now, levels });
    return [...levels];
  } catch (error) {
    console.error("upgrade level read failed", error);
    if (hit?.levels) return [...hit.levels];
    remember(key, { at: now, levels: null });
    return zeros();
  }
}

/** Always reads Fuji, then replaces the cache. Used after a purchase receipt. */
export async function refreshUpgradeLevels(address: string) {
  const contracts = getContracts();
  if (!contracts.upgradesDeployed) {
    throw new GameError(409, "upgrades_not_deployed", "The upgrades contract is not configured.");
  }

  const key = address.toLowerCase();
  try {
    const levels = await readLevels(address);
    remember(key, { at: Date.now(), levels });
    return levels;
  } catch (error) {
    console.error("upgrade level refresh failed", error);
    throw new GameError(503, "upgrades_unavailable", "Fuji did not return upgrade levels. Try again.");
  }
}
