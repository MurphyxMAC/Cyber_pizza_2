import {
  cooldownAtLevel,
  getIngredient,
  INGREDIENT_IDS,
  ingredientIndex,
  projectRecipe,
  upgradePriceCpt,
  UPGRADE_MAX_LEVEL,
  type GameState,
  type IngredientId,
  type IngredientState,
  type OpenClaim,
  type RecipeId,
} from "@cyberpizza/shared";
import { getAddress, type Hex } from "viem";
import { getContracts } from "./contracts";
import { getSql } from "./db";
import { GameError } from "./errors";
import { assertMenuRecipe, loadMenu } from "./recipes";
import { getSession } from "./session";
import { assertSignerConfigured, signClaim } from "./signer";
import { getUpgradeLevels } from "./upgrades";

type UserRow = {
  address: string;
  pending_cpt: string;
  claim_nonce: string | number;
  pizzas_baked: number;
};

type InventoryRow = {
  ingredient: IngredientId;
  amount: number;
  last_collected_at: Date | null;
};

type ClaimRow = {
  claim_id: string;
  amount: string;
  amount_wei: string;
  nonce: string | number;
  deadline_unix: string | number;
  signature: string | null;
  needs_signature: boolean;
};

type OpenClaimRow = {
  id: string;
  amount: string;
  amount_wei: string;
  nonce: string | number;
  deadline_unix: string | number;
  signature: string | null;
  status: "pending";
};

function ingredientList() {
  return getSql().array([...INGREDIENT_IDS]);
}

export async function requireUser() {
  const session = await getSession();
  if (!session.address || !/^0x[0-9a-f]{40}$/.test(session.address)) {
    throw new GameError(401, "unauthorized", "Sign in with your wallet first.");
  }
  return session.address;
}

export async function ensureUser(address: string) {
  const sql = getSql();
  await sql`select ensure_user(${address}, ${ingredientList()})`;
}

function readyAt(lastCollectedAt: Date | null, cooldownSeconds: number) {
  if (!lastCollectedAt) return null;
  return new Date(lastCollectedAt.getTime() + cooldownSeconds * 1000).toISOString();
}

export async function getGameState(address: string): Promise<GameState> {
  const sql = getSql();
  const [user] = await sql<UserRow[]>`
    select address, pending_cpt::text, claim_nonce, pizzas_baked
    from users
    where address = ${address}
  `;
  if (!user) {
    throw new GameError(404, "not_found", "Sign in again to open a shift.");
  }

  const inventory = await sql<InventoryRow[]>`
    select ingredient, amount, last_collected_at
    from inventory
    where user_id = (select id from users where address = ${address})
  `;
  const byId = new Map(inventory.map((row) => [row.ingredient, row]));
  const now = Date.now();
  const levels = await getUpgradeLevels(address);
  const owned: Partial<Record<IngredientId, number>> = {};

  const cards: IngredientState[] = INGREDIENT_IDS.map((id) => {
    const meta = getIngredient(id);
    const row = byId.get(id);
    const amount = row?.amount ?? 0;
    owned[id] = amount;
    const upgradeLevel = levels[ingredientIndex(id)] ?? 0;
    const cooldownSeconds = cooldownAtLevel(meta.cooldownSeconds, upgradeLevel);
    const nextReady = readyAt(row?.last_collected_at ?? null, cooldownSeconds);
    const cooled = !nextReady || new Date(nextReady).getTime() <= now;
    const price = upgradePriceCpt(id, upgradeLevel);
    return {
      id,
      name: meta.name,
      blurb: meta.blurb,
      accent: meta.accent,
      amount,
      cap: meta.cap,
      cooldownSeconds,
      baseCooldownSeconds: meta.cooldownSeconds,
      upgradeLevel,
      nextCooldownSeconds:
        upgradeLevel >= UPGRADE_MAX_LEVEL ? null : cooldownAtLevel(meta.cooldownSeconds, upgradeLevel + 1),
      upgradePriceCpt: price === null ? null : String(price),
      lastCollectedAt: row?.last_collected_at ? row.last_collected_at.toISOString() : null,
      readyAt: nextReady,
      ready: amount < meta.cap && cooled,
    };
  });

  const menu = await loadMenu();
  const recipes = menu.map((recipe) => projectRecipe(recipe, owned));

  const [open] = await sql<OpenClaimRow[]>`
    select
      c.id,
      c.amount::text,
      c.amount_wei::text,
      c.nonce,
      extract(epoch from c.deadline)::bigint as deadline_unix,
      c.signature,
      c.status
    from claims c
    join users u on u.id = c.user_id
    where u.address = ${address} and c.status = 'pending'
    order by c.created_at desc
    limit 1
  `;

  const contracts = getContracts();
  const openClaim: OpenClaim | null = open
    ? {
        id: open.id,
        amount: open.amount,
        amountWei: open.amount_wei,
        nonce: String(open.nonce),
        deadline: String(open.deadline_unix),
        signature: open.signature ? (open.signature as Hex) : null,
        status: "pending",
      }
    : null;

  return {
    address,
    pendingCpt: user.pending_cpt,
    claimNonce: String(user.claim_nonce),
    pizzasBaked: user.pizzas_baked,
    serverNow: new Date().toISOString(),
    inventory: cards,
    recipes,
    openClaim,
    contracts: {
      deployed: contracts.deployed,
      cptToken: contracts.cptToken,
      pizzaRewards: contracts.pizzaRewards,
      upgrades: contracts.upgrades,
      upgradesDeployed: contracts.upgradesDeployed,
    },
  };
}

export async function collectIngredient(address: string, ingredient: IngredientId) {
  const meta = getIngredient(ingredient);
  const levels = await getUpgradeLevels(address);
  const cooldownSeconds = cooldownAtLevel(meta.cooldownSeconds, levels[ingredientIndex(ingredient)] ?? 0);
  const sql = getSql();
  await sql`
    select * from collect_ingredient(
      ${address},
      ${ingredientList()},
      ${ingredient},
      ${meta.cap},
      ${cooldownSeconds}
    )
  `;
  return getGameState(address);
}

export async function makePizza(address: string, recipeId: RecipeId) {
  await assertMenuRecipe(recipeId);
  const sql = getSql();
  await sql`
    select * from make_pizza(${address}, ${ingredientList()}, ${recipeId})
  `;
  return getGameState(address);
}

function deadlineSeconds() {
  const raw = Number(process.env.CLAIM_DEADLINE_SECONDS ?? 3600);
  if (!Number.isFinite(raw) || raw < 60 || raw > 60 * 60 * 24 * 7) return 3600;
  return Math.floor(raw);
}

export async function prepareClaim(address: string) {
  const contracts = assertSignerConfigured();
  const deadlineUnix = Math.floor(Date.now() / 1000) + deadlineSeconds();
  const sql = getSql();
  const [row] = await sql<ClaimRow[]>`
    select * from prepare_claim(${address}, ${deadlineUnix})
  `;
  if (!row) {
    throw new GameError(500, "claim_failed", "The claim could not be prepared.");
  }

  let signature = row.signature;
  if (row.needs_signature || !signature) {
    const signed = await signClaim({
      user: getAddress(address),
      amount: BigInt(row.amount_wei),
      nonce: BigInt(row.nonce),
      deadline: BigInt(row.deadline_unix),
    });
    signature = signed.signature;
    await sql`select attach_claim_signature(${address}, ${row.claim_id}::uuid, ${signature})`;
  }

  const state = await getGameState(address);
  return {
    claim: {
      user: getAddress(address),
      amount: row.amount,
      amountWei: row.amount_wei,
      nonce: String(row.nonce),
      deadline: String(row.deadline_unix),
      signature: signature as Hex,
      pizzaRewards: getAddress(contracts.pizzaRewards),
      chainId: 43113,
    },
    state,
  };
}
