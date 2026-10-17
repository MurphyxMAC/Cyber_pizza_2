export const FUJI_CHAIN_ID = 43113 as const;

export const SIWE_STATEMENT =
  "Sign in to the CyberPizza night shift. This does not spend gas.";

export const EIP712_NAME = "PizzaRewards";
export const EIP712_VERSION = "1";

export const CPT_DECIMALS = 18;
export const CPT_WEI = 10n ** BigInt(CPT_DECIMALS);

/** Whole CPT credited when the Neon Supreme recipe is baked. Must match that recipes row. */
export const PIZZA_CPT_REWARD = 10;

export const RECIPE_ID = "neon-supreme";
export const RECIPE_NAME = "Neon Supreme";

/**
 * Cooldown upgrades. These numbers are the contract's constants in Upgrades.sol.
 * Level 0→1 costs 5 CPT and the price doubles each level. Each level removes 12%
 * of the base cooldown, floored, and level 5 leaves 40%. The server applies the
 * cooldown; the contract only stores the level.
 */
export const UPGRADE_MAX_LEVEL = 5;
export const UPGRADE_BURN_BPS = 5_000;
export const UPGRADE_REDUCTION_BPS_PER_LEVEL = 1_200;
export const UPGRADE_MIN_COOLDOWN_BPS = 4_000;
export const UPGRADE_LEVEL_PRICES_CPT = [5, 10, 20, 40, 80] as const;
/** How long a process may reuse an on-chain level read. */
export const UPGRADE_LEVEL_CACHE_MS = 15_000;

export const DEFAULT_CLAIM_DEADLINE_SECONDS = 60 * 60;
export const DEFAULT_DAILY_MINT_CAP_CPT = 10_000;

/**
 * Tray order is the on-chain upgrade id (0..8). Do not reorder.
 * cheese, pepperoni, mushrooms, cybertruffles, neontomatoes,
 * holobasil, quantumcheese, nanopeppers, cyberbacon.
 */
export const INGREDIENTS = [
  {
    id: "cheese",
    name: "Cheese",
    blurb: "Slow melt from the lower docks.",
    cooldownSeconds: 20,
    cap: 12,
    accent: "#ffc857",
  },
  {
    id: "pepperoni",
    name: "Pepperoni",
    blurb: "Cured under the heat lamps.",
    cooldownSeconds: 25,
    cap: 12,
    accent: "#ff4d3a",
  },
  {
    id: "mushrooms",
    name: "Mushrooms",
    blurb: "Grown in the coolant tunnels.",
    cooldownSeconds: 30,
    cap: 10,
    accent: "#d7c4a3",
  },
  {
    id: "cybertruffles",
    name: "Cybertruffles",
    blurb: "Sniffed out by drone hogs.",
    cooldownSeconds: 45,
    cap: 8,
    accent: "#c084fc",
  },
  {
    id: "neontomatoes",
    name: "Neon Tomatoes",
    blurb: "Hydroponic. Slightly radioactive.",
    cooldownSeconds: 35,
    cap: 10,
    accent: "#ff3d8a",
  },
  {
    id: "holobasil",
    name: "Holo Basil",
    blurb: "Projected fresh. Still counts.",
    cooldownSeconds: 50,
    cap: 8,
    accent: "#3ef0d2",
  },
  {
    id: "quantumcheese",
    name: "Quantum Cheese",
    blurb: "Aged in two timelines at once.",
    cooldownSeconds: 60,
    cap: 6,
    accent: "#7ee0ff",
  },
  {
    id: "nanopeppers",
    name: "Nano Peppers",
    blurb: "Heat measured in picokelvins.",
    cooldownSeconds: 75,
    cap: 6,
    accent: "#ff7a18",
  },
  {
    id: "cyberbacon",
    name: "Cyber Bacon",
    blurb: "Crisped on a GPU exhaust.",
    cooldownSeconds: 90,
    cap: 6,
    accent: "#ff8fab",
  },
] as const;

export type IngredientId = (typeof INGREDIENTS)[number]["id"];

export const INGREDIENT_IDS = INGREDIENTS.map((ingredient) => ingredient.id) as [
  IngredientId,
  ...IngredientId[],
];

const ingredientById = new Map<string, (typeof INGREDIENTS)[number]>(
  INGREDIENTS.map((ingredient) => [ingredient.id, ingredient]),
);

export function isIngredientId(value: string): value is IngredientId {
  return ingredientById.has(value);
}

export function getIngredient(id: IngredientId) {
  const ingredient = ingredientById.get(id);
  if (!ingredient) {
    throw new Error(`Unknown ingredient ${id}`);
  }
  return ingredient;
}

const ingredientIndexById = new Map<IngredientId, number>(
  INGREDIENTS.map((ingredient, index) => [ingredient.id, index]),
);

/** On-chain id used by Upgrades.purchase. Matches INGREDIENTS order. */
export function ingredientIndex(id: IngredientId) {
  const index = ingredientIndexById.get(id);
  if (index === undefined) {
    throw new Error(`Unknown ingredient ${id}`);
  }
  return index;
}

export function cooldownAtLevel(baseSeconds: number, level: number) {
  const steps = Math.max(0, Math.min(UPGRADE_MAX_LEVEL, Math.trunc(level)));
  const bps = Math.max(
    UPGRADE_MIN_COOLDOWN_BPS,
    10_000 - steps * UPGRADE_REDUCTION_BPS_PER_LEVEL,
  );
  return Math.max(1, Math.floor((baseSeconds * bps) / 10_000));
}

/** Whole CPT to buy the next level, or null when `currentLevel` is already maxed. */
export function upgradePriceCpt(currentLevel: number) {
  const level = Math.trunc(currentLevel);
  if (level < 0 || level >= UPGRADE_MAX_LEVEL) return null;
  return UPGRADE_LEVEL_PRICES_CPT[level];
}

export function upgradePriceWei(currentLevel: number) {
  const whole = upgradePriceCpt(currentLevel);
  if (whole === undefined || whole === null) return null;
  return BigInt(whole) * CPT_WEI;
}

export type RecipeIngredient = {
  id: IngredientId;
  quantity: number;
};

export type RecipeSeed = {
  id: string;
  name: string;
  blurb: string;
  cptReward: number;
  sortOrder: number;
  ingredients: readonly RecipeIngredient[];
};

/**
 * Menu economics. Cost is the sum of quantity × base cooldown seconds.
 * Pepperoni-only is the small pie. Mixes pay a bit more. Rare trays
 * (cooldown ≥ 45s) pay more CPT per second of cooldown than Neon Supreme.
 * Neon Supreme stays at 10 CPT. The recipes table must match this list.
 */
export const RECIPES = [
  {
    id: "redline-pepperoni",
    name: "Redline Pepperoni",
    blurb: "Four cups of heat-lamp pepperoni. No garnish.",
    cptReward: 2,
    sortOrder: 10,
    ingredients: [{ id: "pepperoni", quantity: 4 }],
  },
  {
    id: "dockside-melt",
    name: "Dockside Melt",
    blurb: "Cheese and pepperoni slumped over dock mushrooms.",
    cptReward: 3,
    sortOrder: 20,
    ingredients: [
      { id: "cheese", quantity: 2 },
      { id: "pepperoni", quantity: 2 },
      { id: "mushrooms", quantity: 1 },
    ],
  },
  {
    id: "glitch-margherita",
    name: "Glitch Margherita",
    blurb: "A doubled margherita with a holo-basil smear.",
    cptReward: 4,
    sortOrder: 30,
    ingredients: [
      { id: "cheese", quantity: 2 },
      { id: "neontomatoes", quantity: 2 },
      { id: "holobasil", quantity: 1 },
    ],
  },
  {
    id: "coolant-funghi",
    name: "Coolant Funghi",
    blurb: "Tunnel mushrooms, one cybertruffle, basil to cut the damp.",
    cptReward: 5,
    sortOrder: 40,
    ingredients: [
      { id: "cheese", quantity: 1 },
      { id: "mushrooms", quantity: 2 },
      { id: "cybertruffles", quantity: 1 },
      { id: "holobasil", quantity: 1 },
    ],
  },
  {
    id: "neon-supreme",
    name: "Neon Supreme",
    blurb: "One of every tray. The house pie.",
    cptReward: 10,
    sortOrder: 50,
    ingredients: [
      { id: "cheese", quantity: 1 },
      { id: "pepperoni", quantity: 1 },
      { id: "mushrooms", quantity: 1 },
      { id: "cybertruffles", quantity: 1 },
      { id: "neontomatoes", quantity: 1 },
      { id: "holobasil", quantity: 1 },
      { id: "quantumcheese", quantity: 1 },
      { id: "nanopeppers", quantity: 1 },
      { id: "cyberbacon", quantity: 1 },
    ],
  },
  {
    id: "truffle-protocol",
    name: "Truffle Protocol",
    blurb: "Rare fungi and quantum cheese, finished with basil.",
    cptReward: 8,
    sortOrder: 60,
    ingredients: [
      { id: "cybertruffles", quantity: 2 },
      { id: "quantumcheese", quantity: 2 },
      { id: "holobasil", quantity: 1 },
    ],
  },
  {
    id: "afterburner",
    name: "Afterburner",
    blurb: "Nano heat and GPU-crisp bacon on a pepperoni base.",
    cptReward: 12,
    sortOrder: 70,
    ingredients: [
      { id: "pepperoni", quantity: 1 },
      { id: "nanopeppers", quantity: 2 },
      { id: "cyberbacon", quantity: 2 },
    ],
  },
  {
    id: "blackout-feast",
    name: "Blackout Feast",
    blurb: "The rare trays, doubled where they matter.",
    cptReward: 16,
    sortOrder: 80,
    ingredients: [
      { id: "cybertruffles", quantity: 2 },
      { id: "quantumcheese", quantity: 2 },
      { id: "holobasil", quantity: 1 },
      { id: "nanopeppers", quantity: 1 },
      { id: "cyberbacon", quantity: 1 },
    ],
  },
] as const satisfies readonly RecipeSeed[];

export type RecipeId = (typeof RECIPES)[number]["id"];
export type RecipeDefinition = (typeof RECIPES)[number];

export const RECIPE_IDS = RECIPES.map((recipe) => recipe.id) as [RecipeId, ...RecipeId[]];

const recipeById = new Map<string, RecipeDefinition>(RECIPES.map((recipe) => [recipe.id, recipe]));

export function isRecipeId(value: string): value is RecipeId {
  return recipeById.has(value);
}

export function getRecipe(id: string) {
  return recipeById.get(id);
}

/** Sum of quantity × base cooldown. Used to check that rewards track cost. */
export function recipeCooldownCost(recipe: { ingredients: readonly RecipeIngredient[] }) {
  return recipe.ingredients.reduce(
    (sum, item) => sum + item.quantity * getIngredient(item.id).cooldownSeconds,
    0,
  );
}

export const CLAIM_TYPES = {
  Claim: [
    { name: "user", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function isDeployedAddress(value: string | null | undefined): value is `0x${string}` {
  return (
    typeof value === "string" &&
    /^0x[0-9a-fA-F]{40}$/.test(value) &&
    value.toLowerCase() !== ZERO_ADDRESS
  );
}
