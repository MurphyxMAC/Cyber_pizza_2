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
  UPGRADE_MAX_LEVEL,
  UPGRADE_PRICE_WEIGHT_BPS,
  upgradePriceCpt,
  upgradePriceWei,
  upgradeTotalCpt,
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

test("upgrade track is 40 levels with a rising price and a 20 percent floor", () => {
  assert.equal(UPGRADE_MAX_LEVEL, 40);
  assert.equal(UPGRADE_PRICE_WEIGHT_BPS.length, INGREDIENTS.length);

  const expected = [
    ["cheese", 20, 16_400, 20, 4],
    ["pepperoni", 22, 18_040, 25, 5],
    ["mushrooms", 24, 19_680, 30, 6],
    ["cybertruffles", 32, 26_240, 45, 9],
    ["neontomatoes", 26, 21_320, 35, 7],
    ["holobasil", 30, 24_600, 50, 10],
    ["quantumcheese", 36, 29_520, 60, 12],
    ["nanopeppers", 40, 32_800, 75, 15],
    ["cyberbacon", 44, 36_080, 90, 18],
  ] as const;

  for (const [id, first, total, base, atMax] of expected) {
    const ingredient = INGREDIENTS.find((item) => item.id === id);
    assert.ok(ingredient);
    assert.equal(ingredient.cooldownSeconds, base);
    assert.equal(upgradePriceCpt(id, 0), first);
    assert.equal(upgradePriceCpt(id, 1), first * 2);
    assert.equal(upgradeTotalCpt(id), total);
    assert.equal(upgradePriceCpt(id, UPGRADE_MAX_LEVEL), null);
    assert.equal(cooldownAtLevel(base, 0), base);
    assert.equal(cooldownAtLevel(base, UPGRADE_MAX_LEVEL), atMax);
    assert.ok(cooldownAtLevel(base, 1) < base);
    assert.ok(cooldownAtLevel(base, UPGRADE_MAX_LEVEL) >= Math.floor(base / 5));
  }

  assert.equal(upgradePriceWei("cheese", 0), 20n * CPT_WEI);
  assert.equal(upgradePriceWei("cyberbacon", 0), 44n * CPT_WEI);
  assert.ok(upgradeTotalCpt("cyberbacon") > upgradeTotalCpt("cheese"));
  assert.ok(upgradeTotalCpt("cheese") > 10_000);
  assert.ok(upgradeTotalCpt("cyberbacon") < 50_000);
});
