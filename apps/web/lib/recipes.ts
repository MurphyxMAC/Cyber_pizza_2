import {
  getRecipe,
  isIngredientId,
  RECIPES,
  type IngredientId,
  type RecipeDefinition,
  type RecipeId,
} from "@cyberpizza/shared";
import { getSql } from "./db";
import { GameError } from "./errors";

type RecipeRow = {
  id: string;
  name: string;
  blurb: string;
  cpt_reward: string;
  ingredients: unknown;
  sort_order: number;
};

function asQuantity(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 100) return value;
  if (typeof value === "string" && /^[1-9]\d{0,2}$/.test(value)) {
    const parsed = Number(value);
    if (parsed >= 1 && parsed <= 100) return parsed;
  }
  return null;
}

export function parseRecipeIngredients(value: unknown) {
  const source = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
  if (typeof source !== "object" || source === null || Array.isArray(source)) {
    throw new GameError(
      500,
      "recipe_invalid",
      "Recipe ingredients are not a quantity map. Apply the latest migration.",
    );
  }

  const items: { id: IngredientId; quantity: number }[] = [];
  for (const [id, raw] of Object.entries(source)) {
    const quantity = asQuantity(raw);
    if (!isIngredientId(id) || quantity === null) {
      throw new GameError(500, "recipe_invalid", "A recipe row has an invalid ingredient.");
    }
    items.push({ id, quantity });
  }
  if (items.length === 0) {
    throw new GameError(500, "recipe_invalid", "A recipe row has no ingredients.");
  }
  return items;
}

function sameIngredients(
  actual: { id: IngredientId; quantity: number }[],
  expected: RecipeDefinition["ingredients"],
) {
  if (actual.length !== expected.length) return false;
  const counts = new Map(actual.map((item) => [item.id, item.quantity]));
  return expected.every((item) => counts.get(item.id) === item.quantity);
}

/** Loads the menu and refuses to continue when the table drifts from the shared catalog. */
export async function loadMenu(): Promise<RecipeDefinition[]> {
  const sql = getSql();
  const rows = await sql<RecipeRow[]>`
    select id, name, blurb, cpt_reward::text, ingredients, sort_order
    from recipes
  `;
  const byId = new Map(rows.map((row) => [row.id, row]));

  return RECIPES.map((recipe) => {
    const row = byId.get(recipe.id);
    if (!row) {
      throw new GameError(
        500,
        "recipe_missing",
        "A menu recipe is not seeded. Apply the latest migration.",
      );
    }
    const ingredients = parseRecipeIngredients(row.ingredients);
    const rewardMatches = row.cpt_reward === String(recipe.cptReward);
    const aligned =
      row.name === recipe.name &&
      row.blurb === recipe.blurb &&
      row.sort_order === recipe.sortOrder &&
      rewardMatches &&
      sameIngredients(ingredients, recipe.ingredients);
    if (!aligned) {
      throw new GameError(
        500,
        "recipe_mismatch",
        "The recipes table does not match the server menu. Apply the latest migration.",
      );
    }
    return recipe;
  });
}

export async function assertMenuRecipe(recipeId: RecipeId) {
  const recipe = getRecipe(recipeId);
  if (!recipe) {
    throw new GameError(409, "unknown_recipe", "That recipe is not on the board.");
  }
  const menu = await loadMenu();
  if (!menu.some((item) => item.id === recipeId)) {
    throw new GameError(409, "unknown_recipe", "That recipe is not on the board.");
  }
  return recipe;
}
