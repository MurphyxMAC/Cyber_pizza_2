import assert from "node:assert/strict";
import test from "node:test";
import {
  cooldownAtLevel,
  FUJI_CHAIN_ID,
  INGREDIENTS,
  INGREDIENT_IDS,
  PIZZA_CPT_REWARD,
  RECIPES,
  recipeCooldownCost,
  UPGRADE_LEVEL_PRICES_CPT,
  UPGRADE_MAX_LEVEL,
  upgradePriceCpt,
  upgradePriceWei,
  CPT_WEI,
  getRecipe,
} from "./constants.ts";

test("nine toppings, stable on-chain order, positive caps", () => {
  assert.deepEqual(INGREDIENT_IDS, [
    "cheese",
    "pepperoni",
    "mushrooms",
    "cybertruffles",
    "neontomatoes",
    "holobasil",
    "quantumcheese",
    "nanopeppers",
    "cyberbacon",
  ]);
  assert.equal(new Set(INGREDIENT_IDS).size, 9);
  for (const ingredient of INGREDIENTS) {
    assert.ok(ingredient.cap > 0);
    assert.ok(ingredient.cooldownSeconds > 0);
  }
});

test("pizza reward and fuji chain are pinned", () => {
  assert.equal(PIZZA_CPT_REWARD, 10);
  assert.equal(FUJI_CHAIN_ID, 43113);
  assert.equal(getRecipe("neon-supreme")?.cptReward, PIZZA_CPT_REWARD);
});

test("menu rewards and quantities are pinned", () => {
  assert.deepEqual(
    RECIPES.map((recipe) => ({
      id: recipe.id,
      cptReward: recipe.cptReward,
      ingredients: recipe.ingredients.map((item) => [item.id, item.quantity]),
    })),
    [
      { id: "redline-pepperoni", cptReward: 2, ingredients: [["pepperoni", 4]] },
      {
        id: "dockside-melt",
        cptReward: 3,
        ingredients: [
          ["cheese", 2],
          ["pepperoni", 2],
          ["mushrooms", 1],
        ],
      },
      {
        id: "glitch-margherita",
        cptReward: 4,
        ingredients: [
          ["cheese", 2],
          ["neontomatoes", 2],
          ["holobasil", 1],
        ],
      },
      {
        id: "coolant-funghi",
        cptReward: 5,
        ingredients: [
          ["cheese", 1],
          ["mushrooms", 2],
          ["cybertruffles", 1],
          ["holobasil", 1],
        ],
      },
      {
        id: "neon-supreme",
        cptReward: 10,
        ingredients: INGREDIENT_IDS.map((id) => [id, 1]),
      },
      {
        id: "truffle-protocol",
        cptReward: 8,
        ingredients: [
          ["cybertruffles", 2],
          ["quantumcheese", 2],
          ["holobasil", 1],
        ],
      },
      {
        id: "afterburner",
        cptReward: 12,
        ingredients: [
          ["pepperoni", 1],
          ["nanopeppers", 2],
          ["cyberbacon", 2],
        ],
      },
      {
        id: "blackout-feast",
        cptReward: 16,
        ingredients: [
          ["cybertruffles", 2],
          ["quantumcheese", 2],
          ["holobasil", 1],
          ["nanopeppers", 1],
          ["cyberbacon", 1],
        ],
      },
    ],
  );

  for (const recipe of RECIPES) {
    const ids = recipe.ingredients.map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const item of recipe.ingredients) {
      const meta = INGREDIENTS.find((ingredient) => ingredient.id === item.id);
      assert.ok(meta);
      assert.ok(item.quantity >= 1);
      assert.ok(item.quantity <= meta.cap);
    }
  }
});

test("rewards scale with cooldown cost and rarity", () => {
  const redline = getRecipe("redline-pepperoni");
  const neon = getRecipe("neon-supreme");
  const truffle = getRecipe("truffle-protocol");
  const blackout = getRecipe("blackout-feast");
  assert.ok(redline && neon && truffle && blackout);

  const rate = (recipe: NonNullable<typeof redline>) => recipe.cptReward / recipeCooldownCost(recipe);
  assert.equal(recipeCooldownCost(redline), 100);
  assert.equal(recipeCooldownCost(neon), 430);
  assert.ok(redline.cptReward < neon.cptReward);
  assert.ok(blackout.cptReward > neon.cptReward);
  assert.ok(rate(redline) <= rate(neon));
  assert.ok(rate(truffle) > rate(neon));
  assert.ok(rate(blackout) > rate(truffle));
});

test("upgrade prices double and cooldowns floor at 40 percent", () => {
  assert.deepEqual(UPGRADE_LEVEL_PRICES_CPT, [5, 10, 20, 40, 80]);
  assert.equal(upgradePriceCpt(0), 5);
  assert.equal(upgradePriceCpt(4), 80);
  assert.equal(upgradePriceCpt(UPGRADE_MAX_LEVEL), null);
  assert.equal(upgradePriceWei(0), 5n * CPT_WEI);

  assert.equal(cooldownAtLevel(20, 0), 20);
  assert.equal(cooldownAtLevel(20, 1), 17);
  assert.equal(cooldownAtLevel(20, 5), 8);
  assert.equal(cooldownAtLevel(90, 1), 79);
  assert.equal(cooldownAtLevel(90, 5), 36);
  assert.equal(cooldownAtLevel(90, 99), 36);

  const cheese = [20, 17, 15, 12, 10, 8];
  const bacon = [90, 79, 68, 57, 46, 36];
  for (let level = 0; level <= UPGRADE_MAX_LEVEL; level += 1) {
    assert.equal(cooldownAtLevel(20, level), cheese[level]);
    assert.equal(cooldownAtLevel(90, level), bacon[level]);
    assert.ok(cooldownAtLevel(25, level) >= 1);
  }
});
