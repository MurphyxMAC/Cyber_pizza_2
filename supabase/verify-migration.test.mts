import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const ADDRESS = `0x${"ab".repeat(20)}`;
const INGREDIENTS = [
  "cheese",
  "pepperoni",
  "mushrooms",
  "cybertruffles",
  "neontomatoes",
  "holobasil",
  "quantumcheese",
  "nanopeppers",
  "cyberbacon",
];

async function database() {
  const db = new PGlite();
  const sql = await readFile(new URL("./migrations/20261014180000_init.sql", import.meta.url), "utf8");
  await db.exec(sql);
  return db;
}

test("collect enforces cooldown and pizza claim reserves nonce once", async () => {
  const db = await database();

  const first = await db.query<{ amount: number }>(
    "select amount from collect_ingredient($1, $2::text[], 'cheese', 12, 20)",
    [ADDRESS, INGREDIENTS],
  );
  assert.equal(Number(first.rows[0]?.amount), 1);

  await assert.rejects(
    db.query("select amount from collect_ingredient($1, $2::text[], 'cheese', 12, 20)", [
      ADDRESS,
      INGREDIENTS,
    ]),
    /cooldown/,
  );

  await db.query(
    "update inventory set amount = 1, last_collected_at = null where user_id = (select id from users where address = $1)",
    [ADDRESS],
  );

  const baked = await db.query<{ pending_cpt: string; pizzas_baked: number }>(
    "select pending_cpt::text, pizzas_baked from make_pizza($1, $2::text[], 'neon-supreme')",
    [ADDRESS, INGREDIENTS],
  );
  assert.equal(baked.rows[0]?.pending_cpt, "10");
  assert.equal(Number(baked.rows[0]?.pizzas_baked), 1);

  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const created = await db.query<{
    nonce: string;
    amount: string;
    amount_wei: string;
    needs_signature: boolean;
    claim_id: string;
  }>("select claim_id, amount::text, amount_wei::text, nonce::text, needs_signature from prepare_claim($1, $2)", [
    ADDRESS,
    deadline,
  ]);
  assert.equal(created.rows[0]?.amount, "10");
  assert.equal(created.rows[0]?.amount_wei, "10000000000000000000");
  assert.equal(created.rows[0]?.nonce, "0");
  assert.equal(created.rows[0]?.needs_signature, true);

  const user = await db.query<{ pending_cpt: string; claim_nonce: string }>(
    "select pending_cpt::text, claim_nonce::text from users where address = $1",
    [ADDRESS],
  );
  assert.equal(user.rows[0]?.pending_cpt, "0");
  assert.equal(user.rows[0]?.claim_nonce, "1");

  const again = await db.query<{ claim_id: string; nonce: string }>(
    "select claim_id, nonce::text from prepare_claim($1, $2)",
    [ADDRESS, deadline + 10],
  );
  assert.equal(again.rows[0]?.claim_id, created.rows[0]?.claim_id);
  assert.equal(again.rows[0]?.nonce, "0");

  const still = await db.query<{ claim_nonce: string }>(
    "select claim_nonce::text from users where address = $1",
    [ADDRESS],
  );
  assert.equal(still.rows[0]?.claim_nonce, "1");

  await db.query("select attach_claim_signature($1, $2, $3)", [
    ADDRESS,
    created.rows[0]?.claim_id,
    `0x${"11".repeat(65)}`,
  ]);

  await db.query("update users set pending_cpt = 10 where address = $1", [ADDRESS]);
  const held = await db.query<{ amount: string; nonce: string }>(
    "select amount::text, nonce::text from prepare_claim($1, $2)",
    [ADDRESS, deadline + 20],
  );
  assert.equal(held.rows[0]?.amount, "10");
  assert.equal(held.rows[0]?.nonce, "0");

  await db.query("select confirm_claim($1, 0, $2)", [ADDRESS, `0x${"ab".repeat(32)}`]);
  const next = await db.query<{ nonce: string; amount: string }>(
    "select nonce::text, amount::text from prepare_claim($1, $2)",
    [ADDRESS, deadline + 30],
  );
  assert.equal(next.rows[0]?.nonce, "1");
  assert.equal(next.rows[0]?.amount, "10");

  const finalUser = await db.query<{ pending_cpt: string; claim_nonce: string }>(
    "select pending_cpt::text, claim_nonce::text from users where address = $1",
    [ADDRESS],
  );
  assert.equal(finalUser.rows[0]?.pending_cpt, "0");
  assert.equal(finalUser.rows[0]?.claim_nonce, "2");

  await db.close();
});

test("a rejected claim does not spend pending CPT", async () => {
  const db = await database();
  await db.query("select ensure_user($1, $2::text[])", [ADDRESS, INGREDIENTS]);
  await db.query("update users set pending_cpt = 5 where address = $1", [ADDRESS]);
  const past = Math.floor(Date.now() / 1000) - 60;
  await assert.rejects(db.query("select * from prepare_claim($1, $2)", [ADDRESS, past]), /deadline/);
  const user = await db.query<{ pending_cpt: string; claim_nonce: string }>(
    "select pending_cpt::text, claim_nonce::text from users where address = $1",
    [ADDRESS],
  );
  assert.equal(user.rows[0]?.pending_cpt, "5");
  assert.equal(user.rows[0]?.claim_nonce, "0");
  await db.close();
});
