import assert from "node:assert/strict";
import test from "node:test";
import { INGREDIENTS, INGREDIENT_IDS, PIZZA_CPT_REWARD, FUJI_CHAIN_ID } from "./constants.ts";

test("nine toppings, unique ids, positive caps", () => {
  assert.equal(INGREDIENTS.length, 9);
  assert.equal(new Set(INGREDIENT_IDS).size, 9);
  for (const ingredient of INGREDIENTS) {
    assert.ok(ingredient.cap > 0);
    assert.ok(ingredient.cooldownSeconds > 0);
  }
});

test("pizza reward and fuji chain are pinned", () => {
  assert.equal(PIZZA_CPT_REWARD, 10);
  assert.equal(FUJI_CHAIN_ID, 43113);
});
