import { getIngredient, type IngredientId, type RecipeIngredient } from "./constants";

export type OpenClaim = {
  id: string;
  amount: string;
  amountWei: string;
  nonce: string;
  deadline: string;
  signature: `0x${string}` | null;
  status: "pending";
};

export type IngredientState = {
  id: IngredientId;
  name: string;
  blurb: string;
  accent: string;
  amount: number;
  cap: number;
  /** Effective cooldown after the on-chain upgrade level. */
  cooldownSeconds: number;
  baseCooldownSeconds: number;
  upgradeLevel: number;
  /** Cooldown after the next purchase. Null at max level. */
  nextCooldownSeconds: number | null;
  /** Whole CPT for the next level. Null at max level. */
  upgradePriceCpt: string | null;
  lastCollectedAt: string | null;
  readyAt: string | null;
  ready: boolean;
};

export type RecipeIngredientState = {
  id: IngredientId;
  name: string;
  quantity: number;
  owned: number;
  enough: boolean;
};

export type RecipeState = {
  id: string;
  name: string;
  blurb: string;
  cptReward: string;
  canBake: boolean;
  missing: string[];
  ingredients: RecipeIngredientState[];
};

export type GameState = {
  address: string;
  pendingCpt: string;
  claimNonce: string;
  pizzasBaked: number;
  serverNow: string;
  inventory: IngredientState[];
  recipes: RecipeState[];
  openClaim: OpenClaim | null;
  contracts: {
    deployed: boolean;
    cptToken: string;
    pizzaRewards: string;
    upgrades: string;
    upgradesDeployed: boolean;
  };
};

export function projectRecipe(
  recipe: {
    id: string;
    name: string;
    blurb: string;
    cptReward: number | string;
    ingredients: readonly RecipeIngredient[];
  },
  owned: Partial<Record<IngredientId, number>> = {},
): RecipeState {
  const ingredients = recipe.ingredients.map((item) => {
    const have = owned[item.id] ?? 0;
    return {
      id: item.id,
      name: getIngredient(item.id).name,
      quantity: item.quantity,
      owned: have,
      enough: have >= item.quantity,
    };
  });
  return {
    id: recipe.id,
    name: recipe.name,
    blurb: recipe.blurb,
    cptReward: String(recipe.cptReward),
    canBake: ingredients.every((item) => item.enough),
    missing: ingredients
      .filter((item) => !item.enough)
      .map((item) => `${item.name} ${item.owned}/${item.quantity}`),
    ingredients,
  };
}

export type ClaimPayload = {
  user: `0x${string}`;
  amount: string;
  amountWei: string;
  nonce: string;
  deadline: string;
  signature: `0x${string}`;
  pizzaRewards: `0x${string}`;
  chainId: number;
};
