import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("game actions cast every function argument, including the ingredient text[]", async () => {
  const game = await readFile(new URL("./game.ts", import.meta.url), "utf8");
  const confirm = await readFile(new URL("./confirm.ts", import.meta.url), "utf8");

  assert.match(game, /ensure_user\(\$\{address\}::text, \$\{ingredientArrayLiteral\(\)\}::text\[\]\)/);
  assert.match(game, /\$\{address\}::text,\s*\$\{ingredientArrayLiteral\(\)\}::text\[\],\s*\$\{ingredient\}::text,\s*\$\{meta\.cap\}::integer,\s*\$\{cooldownSeconds\}::integer/s);
  assert.match(
    game,
    /make_pizza\(\$\{address\}::text, \$\{ingredientArrayLiteral\(\)\}::text\[\], \$\{recipeId\}::text\)/,
  );
  assert.match(game, /prepare_claim\(\$\{address\}::text, \$\{deadlineUnix\}::bigint\)/);
  assert.match(
    game,
    /attach_claim_signature\(\$\{address\}::text, \$\{row\.claim_id\}::uuid, \$\{signature\}::text\)/,
  );
  assert.match(
    confirm,
    /confirm_claim\(\$\{address\}::text, \$\{match\.args\.nonce\.toString\(\)\}::bigint, \$\{txHash\}::text\)/,
  );
  assert.doesNotMatch(game, /\.array\(/);
  assert.doesNotMatch(confirm, /\.array\(/);
  assert.match(game, /INGREDIENT_IDS\.map\(\(id\) => `"\$\{id\}"`\)/);
});
