import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
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
  const directory = new URL("./migrations/", import.meta.url);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(new URL(`./migrations/${file}`, import.meta.url), "utf8");
    await db.exec(sql);
  }
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

test("a text ingredient parameter does not resolve the text[] functions until it is cast", async () => {
  const db = await database();
  const literal = `{${INGREDIENTS.map((id) => `"${id}"`).join(",")}}`;

  // An untyped parameter can match text[]. A parameter already typed as text,
  // which is what postgres.js sends for a string array on a cold connection,
  // cannot, so resolution fails until the call casts it.
  await assert.rejects(
    db.query("select ensure_user($1, $2::text)", [ADDRESS, literal]),
    /function ensure_user\(unknown, text\) does not exist/,
  );
  await assert.rejects(
    db.query(
      "select amount from collect_ingredient($1, $2::text, 'cheese', 12, 20)",
      [ADDRESS, literal],
    ),
    /function collect_ingredient\(.*\) does not exist/,
  );
  await assert.rejects(
    db.query("select pending_cpt from make_pizza($1, $2::text, 'redline-pepperoni')", [ADDRESS, literal]),
    /function make_pizza\(.*\) does not exist/,
  );

  const created = await db.query<{ id: string }>(
    "select ensure_user($1::text, $2::text[])::text as id",
    [ADDRESS, literal],
  );
  assert.match(created.rows[0]?.id ?? "", /^[0-9a-f-]{36}$/i);

  const collected = await db.query<{ amount: number }>(
    "select amount from collect_ingredient($1::text, $2::text[], $3::text, $4::integer, $5::integer)",
    [ADDRESS, literal, "cheese", 12, 20],
  );
  assert.equal(Number(collected.rows[0]?.amount), 1);

  await db.query(
    "update inventory set amount = 4, last_collected_at = null where user_id = (select id from users where address = $1) and ingredient = 'pepperoni'",
    [ADDRESS],
  );
  const baked = await db.query<{ pending_cpt: string }>(
    "select pending_cpt::text from make_pizza($1::text, $2::text[], $3::text)",
    [ADDRESS, literal, "redline-pepperoni"],
  );
  assert.equal(baked.rows[0]?.pending_cpt, "2");

  await db.close();
});

test("api roles lose execute on game functions and touch_updated_at keeps a search_path", async () => {
  const db = await database();
  const migration = await readFile(
    new URL("./migrations/20261017160000_revoke_api_function_execute.sql", import.meta.url),
    "utf8",
  );
  await db.exec(migration);

  const config = await db.query<{ proconfig: string[] | null }>(
    `select p.proconfig
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'touch_updated_at'`,
  );
  assert.ok(config.rows[0]?.proconfig?.some((item) => item.replace(/\s/g, "") === "search_path=public"));

  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    grant execute on function public.ensure_user(text, text[]) to anon, authenticated;
    grant execute on function public.collect_ingredient(text, text[], text, integer, integer) to anon, authenticated;
    grant execute on function public.make_pizza(text, text[], text) to anon, authenticated;
    grant execute on function public.prepare_claim(text, bigint) to anon, authenticated;
    grant execute on function public.attach_claim_signature(text, uuid, text) to anon, authenticated;
    grant execute on function public.confirm_claim(text, bigint, text) to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
  `);
  await db.exec("create function public.probe_before() returns integer language sql as $$ select 1 $$");

  const before = await db.query<{ anon: boolean }>(`
    select exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral aclexplode(p.proacl) a
      join pg_roles r on r.oid = a.grantee
      where n.nspname = 'public'
        and p.proname = 'probe_before'
        and r.rolname = 'anon'
        and a.privilege_type = 'EXECUTE'
    ) as anon
  `);
  assert.equal(before.rows[0]?.anon, true);

  await db.exec(migration);
  await db.exec(migration);

  const functions = [
    "public.ensure_user(text, text[])",
    "public.collect_ingredient(text, text[], text, integer, integer)",
    "public.make_pizza(text, text[], text)",
    "public.prepare_claim(text, bigint)",
    "public.attach_claim_signature(text, uuid, text)",
    "public.confirm_claim(text, bigint, text)",
  ];
  for (const fn of functions) {
    const priv = await db.query<{ anon: boolean; authenticated: boolean }>(
      "select has_function_privilege('anon', $1, 'execute') as anon, has_function_privilege('authenticated', $1, 'execute') as authenticated",
      [fn],
    );
    assert.equal(priv.rows[0]?.anon, false, fn);
    assert.equal(priv.rows[0]?.authenticated, false, fn);
  }

  await db.exec("create function public.probe_after() returns integer language sql as $$ select 1 $$");
  const after = await db.query<{ anon: boolean; authenticated: boolean }>(`
    select
      coalesce(bool_or(r.rolname = 'anon'), false) as anon,
      coalesce(bool_or(r.rolname = 'authenticated'), false) as authenticated
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join lateral aclexplode(p.proacl) a on true
    left join pg_roles r on r.oid = a.grantee and a.privilege_type = 'EXECUTE'
    where n.nspname = 'public' and p.proname = 'probe_after'
  `);
  assert.equal(after.rows[0]?.anon, false);
  assert.equal(after.rows[0]?.authenticated, false);

  const still = await db.query<{ id: string }>("select ensure_user($1::text, $2::text[])::text as id", [
    ADDRESS,
    INGREDIENTS,
  ]);
  assert.match(still.rows[0]?.id ?? "", /^[0-9a-f-]{36}$/i);

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

test("quantity recipes spend the mapped amount and reject a short tray", async () => {
  const db = await database();
  await db.query("select ensure_user($1, $2::text[])", [ADDRESS, INGREDIENTS]);
  await db.query(
    "update inventory set amount = 4 where user_id = (select id from users where address = $1) and ingredient = 'pepperoni'",
    [ADDRESS],
  );

  const baked = await db.query<{ pending_cpt: string; cpt_reward: string }>(
    "select pending_cpt::text, cpt_reward::text from make_pizza($1, $2::text[], 'redline-pepperoni')",
    [ADDRESS, INGREDIENTS],
  );
  assert.equal(baked.rows[0]?.pending_cpt, "2");
  assert.equal(baked.rows[0]?.cpt_reward, "2");

  const pepperoni = await db.query<{ amount: number }>(
    "select amount from inventory where user_id = (select id from users where address = $1) and ingredient = 'pepperoni'",
    [ADDRESS],
  );
  assert.equal(Number(pepperoni.rows[0]?.amount), 0);

  await db.query(
    "update inventory set amount = 3 where user_id = (select id from users where address = $1) and ingredient = 'pepperoni'",
    [ADDRESS],
  );
  await assert.rejects(
    db.query("select pending_cpt from make_pizza($1, $2::text[], 'redline-pepperoni')", [ADDRESS, INGREDIENTS]),
    /missing ingredients/,
  );
  const held = await db.query<{ amount: number; pending_cpt: string }>(
    `select i.amount, u.pending_cpt::text
     from inventory i
     join users u on u.id = i.user_id
     where u.address = $1 and i.ingredient = 'pepperoni'`,
    [ADDRESS],
  );
  assert.equal(Number(held.rows[0]?.amount), 3);
  assert.equal(held.rows[0]?.pending_cpt, "2");

  await db.query(
    "update inventory set amount = 1 where user_id = (select id from users where address = $1)",
    [ADDRESS],
  );
  await assert.rejects(
    db.query("select pending_cpt from make_pizza($1, $2::text[], 'blackout-feast')", [ADDRESS, INGREDIENTS]),
    /missing ingredients/,
  );
  const untouched = await db.query<{ amount: number }>(
    "select amount from inventory where user_id = (select id from users where address = $1) and ingredient = 'cybertruffles'",
    [ADDRESS],
  );
  assert.equal(Number(untouched.rows[0]?.amount), 1);

  await assert.rejects(
    db.query("select pending_cpt from make_pizza($1, $2::text[], 'not-a-pie')", [ADDRESS, INGREDIENTS]),
    /unknown recipe/,
  );

  const menu = await db.query<{ id: string; cpt_reward: string }>(
    "select id, cpt_reward::text from recipes order by sort_order",
  );
  assert.deepEqual(
    menu.rows.map((row) => [row.id, row.cpt_reward]),
    [
      ["redline-pepperoni", "2"],
      ["dockside-melt", "3"],
      ["glitch-margherita", "4"],
      ["coolant-funghi", "5"],
      ["neon-supreme", "10"],
      ["truffle-protocol", "8"],
      ["afterburner", "12"],
      ["blackout-feast", "16"],
    ],
  );

  await db.close();
});
