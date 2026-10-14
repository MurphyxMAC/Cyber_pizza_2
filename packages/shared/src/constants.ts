export const FUJI_CHAIN_ID = 43113 as const;

export const SIWE_STATEMENT =
  "Sign in to the CyberPizza night shift. This does not spend gas.";

export const EIP712_NAME = "PizzaRewards";
export const EIP712_VERSION = "1";

export const CPT_DECIMALS = 18;
export const CPT_WEI = 10n ** BigInt(CPT_DECIMALS);

/** Whole CPT credited when the Neon Supreme recipe is baked. Must match the recipes seed. */
export const PIZZA_CPT_REWARD = 10;

export const RECIPE_ID = "neon-supreme";
export const RECIPE_NAME = "Neon Supreme";

export const DEFAULT_CLAIM_DEADLINE_SECONDS = 60 * 60;
export const DEFAULT_DAILY_MINT_CAP_CPT = 10_000;

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
