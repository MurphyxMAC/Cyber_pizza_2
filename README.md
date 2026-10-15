# CyberPizza v2

Night-shift pizza kitchen on Avalanche Fuji (chain id **43113**). Connect a wallet, sign in with SIWE, collect nine toppings, bake a Neon Supreme for **10 pending CPT**, then claim that balance on-chain as ERC-20 CPT.

This is a from-scratch Phase 0 + Phase 1 build: Foundry contracts, Supabase-compatible Postgres, and a Next.js booth. The old CyberPizza repo is inspiration only. Nothing was copied from it.

## Layout

```
apps/web                 Next.js 15 street + booth (marketing at /, kitchen at /play)
packages/shared          Ingredient rules, EIP-712 types, ABIs, Fuji addresses
contracts                CPTToken, PizzaRewards, Forge tests, Fuji deploy script
supabase/migrations      users, inventory, recipes, claims, actions_log, claim function
```

## Game rules

Topping ids, cooldowns, and caps live in `packages/shared/src/constants.ts`. The server passes those numbers into Postgres. The client cannot choose an amount.

| Topping | Cooldown | Cap |
| --- | --- | --- |
| cheese | 20s | 12 |
| pepperoni | 25s | 12 |
| mushrooms | 30s | 10 |
| neontomatoes | 35s | 10 |
| cybertruffles | 45s | 8 |
| holobasil | 50s | 8 |
| quantumcheese | 60s | 6 |
| nanopeppers | 75s | 6 |
| cyberbacon | 90s | 6 |

Baking consumes **1 of each** and adds **10** pending CPT. A claim locks the user row, writes a pending claim for the full pending balance, zeroes pending CPT, and bumps `claim_nonce` in one transaction. The server then signs:

```
Claim(address user, uint256 amount, uint256 nonce, uint256 deadline)
```

EIP-712 domain: name `PizzaRewards`, version `1`, chain id `43113`, verifying contract = PizzaRewards.

If a claim is still pending, the next request reuses that nonce (and refreshes the deadline once it expires) so the database nonce cannot run ahead of Fuji. CPT earned during an open claim waits for the next slip. After the mint transaction is confirmed, the booth marks the claim confirmed and the next nonce can be signed.

`PizzaRewards` checks the nonce exactly, increments it, requires `msg.sender == user`, rejects expired deadlines, checks the owner-set signer, and enforces a rolling 24-hour mint cap. It is pausable and non-reentrant. Only `MINTER_ROLE` on `CPTToken` can mint. Holders can burn.

## Prerequisites

- Node.js 22 and pnpm 10
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge` 1.8+)
- Postgres 15+ (Docker or a Supabase project)
- A Fuji wallet with testnet AVAX, plus a WalletConnect Cloud project id if you want the QR modal
- Two keys: a deployer (owner) and a server signer. They can be the same address for a first test. Use a separate signer for anything you leave running.

## Environment

`.env.example` is the only env file in git. Copy it apart:

```bash
# web
cp .env.example apps/web/.env.local
# then keep only the web keys in that file

# contracts — Foundry loads contracts/.env
cp .env.example contracts/.env
```

Generate a session secret:

```bash
openssl rand -base64 32
```

`SESSION_SECRET` must be at least 32 characters. `SIGNER_PRIVATE_KEY` is the key whose address you pass as `SIGNER_ADDRESS` at deploy time. Never commit either file.

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | web | Postgres connection. Use the direct Supabase URI or the session pooler, not transaction mode. The claim path takes a row lock. |
| `SESSION_SECRET` | web | iron-session password. Cookie is httpOnly. |
| `SIGNER_PRIVATE_KEY` | web | EIP-712 claim signer. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | web | WalletConnect Cloud id. Injected wallets still load without it. |
| `NEXT_PUBLIC_CPT_TOKEN_ADDRESS` | web | Overrides `packages/shared` Fuji JSON. |
| `NEXT_PUBLIC_PIZZA_REWARDS_ADDRESS` | web | Overrides `packages/shared` Fuji JSON. |
| `FUJI_RPC_URL` | web + Foundry | Default `https://api.avax-test.network/ext/bc/C/rpc`. |
| `CLAIM_DEADLINE_SECONDS` | web | Signature lifetime. Default 3600. Clamped to 60s–7d. |
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | web | Optional. If both are set, limits use Upstash sliding windows. Otherwise the process keeps an in-memory window. |
| `PRIVATE_KEY` | contracts | Deployer. `0x` + 64 hex chars. |
| `SIGNER_ADDRESS` | contracts | Optional. Defaults to the deployer. |
| `DAILY_MINT_CAP_CPT` | contracts | Whole CPT per 24h. Default 10000. |

## Run the booth locally

```bash
pnpm install
docker compose up -d          # Postgres on localhost:54322
pnpm db:migrate
pnpm dev                      # street http://127.0.0.1:41731 · kitchen /play
```

Without Docker, create a database and set `DATABASE_URL` yourself, then `pnpm db:migrate`.

On Supabase:

1. Create a project.
2. Open the SQL editor and run `supabase/migrations/20261014180000_init.sql`, or install the [Supabase CLI](https://supabase.com/docs/guides/cli), link the project, and `supabase db push`.
3. Copy the **direct** connection string (port 5432) into `DATABASE_URL`. The tables have RLS enabled and no policies, so the anon key cannot read them. The app connects as the database owner, which bypasses RLS. Functions are revoked from `PUBLIC`; the owner can still execute them.

The kitchen page loads without a database. Collect, bake, and claim return a clear error until `DATABASE_URL` is set and the migration has been applied.

`pnpm dev` serves the web app on port **41731**. `/` is the street (marketing). `/play` is the kitchen.

## Contracts

Install dependencies (they are not committed), then test:

```bash
cd contracts
forge install foundry-rs/forge-std --no-git
forge install OpenZeppelin/openzeppelin-contracts@v5.5.0 --no-git
forge test
```

Tests cover mint and burn access, replay, expired deadlines, wrong signer, wrong nonce, `msg.sender` not the user, pause, signer rotation, the global daily cap, a window reset after one day, and fuzz cases for amounts inside and above the cap.

### Deploy to Fuji

1. Fund the deployer with Fuji AVAX from the [Avalanche faucet](https://core.app/tools/testnet-faucet/).
2. Put `PRIVATE_KEY` and optionally `SIGNER_ADDRESS` in `contracts/.env`.
3. Broadcast:

```bash
cd contracts
forge script script/DeployFuji.s.sol \
  --rpc-url fuji \
  --broadcast
```

The script refuses any chain other than 43113. It deploys `CPTToken` (admin = deployer), deploys `PizzaRewards` (signer + owner = deployer unless `SIGNER_ADDRESS` is set, daily cap = `DAILY_MINT_CAP_CPT` whole tokens), grants `MINTER_ROLE` to PizzaRewards, and writes:

- `contracts/deployments/fuji.json`
- `packages/shared/src/deployments/fuji.json`

4. Copy the two addresses into `apps/web/.env.local` as `NEXT_PUBLIC_CPT_TOKEN_ADDRESS` and `NEXT_PUBLIC_PIZZA_REWARDS_ADDRESS`, or rely on the JSON the script just wrote.
5. Put the matching `SIGNER_PRIVATE_KEY` in `apps/web/.env.local`. Restart `pnpm dev`.

The owner can later call `setSigner`, `setDailyMintCap`, `pause`, and `unpause`. A claim larger than the daily cap reverts on-chain and stays pending; raise the cap or wait for the window. The signature does not include the cap, so raising it unblocks the same slip.

## End-to-end on Fuji

1. `pnpm dev` and open `http://127.0.0.1:41731/play`. The street is `http://127.0.0.1:41731`.
2. Connect Core or MetaMask and switch to Avalanche Fuji.
3. **Sign the booth slip.** That is SIWE. It does not send a transaction. The httpOnly cookie stores the address. Game routes ignore any address in the body.
4. Collect all nine toppings. The slowest tray is cyberbacon at 90 seconds, so the first pie takes about that long if you start from empty. Each collect is one topping, capped, and cooldown-gated on the server.
5. **Bake Neon Supreme.** Pending CPT becomes 10. Inventory drops by one each.
6. **Mint CPT.** The booth prepares the claim, signs it, and the wallet sends `PizzaRewards.claim`. You need a little Fuji AVAX for gas. After the receipt, the booth confirms the `Claimed` event and the next nonce opens.
7. Wallet CPT balance on the pass should show 10.

If the mint button says contracts are not deployed, the public addresses are still the zero address.

## Deploy on Vercel

The street and the kitchen are one Next.js app.

1. Import this repository.
2. Set the project **Root Directory** to `apps/web`.
3. Leave the framework preset on Next.js. `apps/web/vercel.json` installs with `pnpm install --filter @cyberpizza/web...`, which pulls that app and its workspace packages. `outputFileTracingRoot` in `apps/web/next.config.ts` points file tracing at the repo root.
4. Add the web keys from `.env.example`. The street renders without them. Collect, bake, and claim need `DATABASE_URL`, `SESSION_SECRET`, and, for minting, a signer key plus deployed Fuji addresses.

CI uses Node.js 22. The root `package.json` `engines` field asks for Node 22 or newer.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test          # topping constants + in-memory rate limit
pnpm test:sql      # migration against embedded Postgres
cd contracts && forge test
pnpm --filter @cyberpizza/web build
```

GitHub Actions runs `forge test`, lint, typecheck, the unit tests, and the migration test.

## Security notes

- The session cookie is the only source of the player address.
- Collect, bake, and claim amounts are computed in Postgres from server constants.
- Rate limits are per IP for auth and per address+IP for game routes. Upstash is used when configured; otherwise memory, which resets when the process restarts.
- An unused claim does not burn the next nonce: the open row is reused until Fuji confirms it.
- The signer key can mint up to the daily cap for any address it signs. Keep it off developer laptops that you do not control, and prefer a signer that is not the owner.

## What you still have to do

The repo does not contain a Supabase project, Fuji AVAX, or a private key.

1. Create a Supabase project (or start Postgres with `docker compose up -d`) and apply the migration.
2. Create a 32+ character `SESSION_SECRET`.
3. Get Fuji AVAX for the deployer and for the wallet you will play with.
4. Create a deployer key and a signer key. Deploy with `forge script`, then set `SIGNER_PRIVATE_KEY` and the two contract addresses in `apps/web/.env.local`.
5. Create a WalletConnect Cloud project if you want WalletConnect QR. Injected wallets work for a local Core/MetaMask test without it.
