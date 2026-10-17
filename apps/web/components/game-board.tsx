"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PizzaMark } from "@/components/pizza-mark";
import { wagmiConfig } from "@/app/providers";
import { RecipeMenu } from "@/components/recipe-menu";
import { UpgradeShop } from "@/components/upgrade-shop";
import {
  cooldownAtLevel,
  cptTokenAbi,
  FUJI_CHAIN_ID,
  INGREDIENTS,
  ingredientIndex,
  pizzaRewardsAbi,
  projectRecipe,
  RECIPES,
  resolveAddresses,
  SIWE_STATEMENT,
  UPGRADE_MAX_LEVEL,
  upgradePriceCpt,
  upgradesAbi,
  type ClaimPayload,
  type GameState,
  type IngredientState,
  type RecipeState,
} from "@cyberpizza/shared";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createSiweMessage } from "viem/siwe";
import { formatUnits, isAddressEqual, type Address } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSignMessage,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";

type SessionResponse = { address: string | null };
type ClaimResponse = { claim: ClaimPayload; state: GameState };

const fallbackContracts = resolveAddresses({
  cptToken: process.env.NEXT_PUBLIC_CPT_TOKEN_ADDRESS,
  pizzaRewards: process.env.NEXT_PUBLIC_PIZZA_REWARDS_ADDRESS,
  upgrades: process.env.NEXT_PUBLIC_UPGRADES_ADDRESS,
});

const previewInventory: IngredientState[] = INGREDIENTS.map((ingredient) => {
  const price = upgradePriceCpt(0);
  return {
    id: ingredient.id,
    name: ingredient.name,
    blurb: ingredient.blurb,
    accent: ingredient.accent,
    amount: 0,
    cap: ingredient.cap,
    cooldownSeconds: ingredient.cooldownSeconds,
    baseCooldownSeconds: ingredient.cooldownSeconds,
    upgradeLevel: 0,
    nextCooldownSeconds: cooldownAtLevel(ingredient.cooldownSeconds, 1),
    upgradePriceCpt: price === null ? null : String(price),
    lastCollectedAt: null,
    readyAt: null,
    ready: false,
  };
});

const previewRecipes: RecipeState[] = RECIPES.map((recipe) => projectRecipe(recipe));

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as { message?: string } & T;
  if (!response.ok) {
    throw new Error(body.message || "The kitchen could not complete that.");
  }
  return body;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  return readJson<T>(response);
}

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatToken(value: bigint) {
  const formatted = formatUnits(value, 18);
  return formatted.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function useKitchenNow(serverNow?: string) {
  const [now, setNow] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!serverNow) return;
    setOffset(new Date(serverNow).getTime() - Date.now());
  }, [serverNow]);

  useEffect(() => {
    const tick = () => setNow(Date.now() + offset);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [offset]);

  return now;
}

function cooldownLabel(item: IngredientState, now: number | null, live: boolean) {
  if (!live) return `${item.cooldownSeconds}s cooldown`;
  if (item.amount >= item.cap) return "Tray full";
  if (now === null) return item.ready || !item.readyAt ? "Ready" : "Cooling";
  if (!item.readyAt) return "Ready";
  const remaining = new Date(item.readyAt).getTime() - now;
  if (remaining <= 0) return "Ready";
  const total = Math.ceil(remaining / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function readableError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (/user rejected/i.test(message)) return "Wallet closed the request.";
  const line = message.split("\n")[0] ?? fallback;
  return line.length > 280 ? `${line.slice(0, 277)}…` : line;
}

export function GameBoard() {
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: () => api<SessionResponse>("/api/auth/session"),
  });

  const sessionAddress = sessionQuery.data?.address ?? null;
  const stateQuery = useQuery({
    queryKey: ["game", sessionAddress],
    enabled: Boolean(sessionAddress),
    queryFn: async () => {
      const response = await fetch("/api/game/state");
      if (response.status === 401) return null;
      return readJson<GameState>(response);
    },
  });

  const state = stateQuery.data ?? null;
  const now = useKitchenNow(state?.serverNow);
  const inventory = state?.inventory ?? previewInventory;
  const recipes = state?.recipes ?? previewRecipes;
  const contracts = state?.contracts ?? {
    deployed: fallbackContracts.deployed,
    cptToken: fallbackContracts.cptToken,
    pizzaRewards: fallbackContracts.pizzaRewards,
    upgrades: fallbackContracts.upgrades,
    upgradesDeployed: fallbackContracts.upgradesDeployed,
  };
  const walletMatches =
    Boolean(sessionAddress && address) &&
    isAddressEqual(sessionAddress as Address, address as Address);
  const onFuji = chainId === FUJI_CHAIN_ID;

  const balance = useReadContract({
    address: contracts.deployed ? (contracts.cptToken as Address) : undefined,
    abi: cptTokenAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(contracts.deployed && address) },
  });

  const allowance = useReadContract({
    address: contracts.upgradesDeployed ? (contracts.cptToken as Address) : undefined,
    abi: cptTokenAbi,
    functionName: "allowance",
    args: address ? [address, contracts.upgrades as Address] : undefined,
    query: { enabled: Boolean(contracts.upgradesDeployed && address) },
  });

  async function refresh() {
    await Promise.all([sessionQuery.refetch(), stateQuery.refetch()]);
  }

  async function signIn() {
    if (!address) {
      setBanner("Connect a wallet on Avalanche Fuji first.");
      return;
    }
    setBusy("sign-in");
    setBanner(null);
    try {
      const { nonce } = await api<{ nonce: string }>("/api/auth/nonce", { method: "POST" });
      const message = createSiweMessage({
        address,
        chainId: FUJI_CHAIN_ID,
        domain: window.location.host,
        uri: window.location.origin,
        version: "1",
        nonce,
        statement: SIWE_STATEMENT,
        issuedAt: new Date(),
        expirationTime: new Date(Date.now() + 10 * 60 * 1000),
      });
      const signature = await signMessageAsync({ message });
      await api("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ message, signature }),
      });
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    } catch (error) {
      setBanner(readableError(error, "Sign-in failed."));
    } finally {
      setBusy(null);
    }
  }

  async function signOut() {
    setBusy("sign-out");
    try {
      await api("/api/auth/logout", { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      queryClient.removeQueries({ queryKey: ["game"] });
    } catch (error) {
      setBanner(readableError(error, "Could not sign out."));
    } finally {
      setBusy(null);
    }
  }

  async function collect(id: IngredientState["id"]) {
    setBusy(id);
    setBanner(null);
    try {
      await api<GameState>("/api/game/collect", {
        method: "POST",
        body: JSON.stringify({ ingredient: id }),
      });
      await stateQuery.refetch();
    } catch (error) {
      setBanner(readableError(error, "Collect failed."));
      await stateQuery.refetch();
    } finally {
      setBusy(null);
    }
  }

  async function bake(recipeId: string) {
    setBusy(`bake:${recipeId}`);
    setBanner(null);
    try {
      await api<GameState>("/api/game/make-pizza", {
        method: "POST",
        body: JSON.stringify({ recipeId }),
      });
      await stateQuery.refetch();
    } catch (error) {
      setBanner(readableError(error, "The oven refused that pie."));
    } finally {
      setBusy(null);
    }
  }

  async function buyUpgrade(id: IngredientState["id"]) {
    if (!address || !walletMatches) {
      setBanner("Connect the same wallet you signed in with to buy an upgrade.");
      return;
    }
    if (!contracts.upgradesDeployed) {
      setBanner("The upgrades contract is not deployed on Fuji yet.");
      return;
    }
    setBusy(`upgrade:${id}`);
    setBanner(null);
    try {
      if (!onFuji) {
        await switchChainAsync({ chainId: FUJI_CHAIN_ID });
      }
      const index = ingredientIndex(id);
      const upgradesAddress = contracts.upgrades as Address;
      const tokenAddress = contracts.cptToken as Address;
      const current = await readContract(wagmiConfig, {
        address: upgradesAddress,
        abi: upgradesAbi,
        functionName: "level",
        args: [address, index],
        chainId: FUJI_CHAIN_ID,
      });
      if (Number(current) >= UPGRADE_MAX_LEVEL) {
        setBanner("That topping is already at max level.");
        await api<GameState>("/api/game/upgrades/refresh", { method: "POST" });
        await stateQuery.refetch();
        return;
      }
      const price = await readContract(wagmiConfig, {
        address: upgradesAddress,
        abi: upgradesAbi,
        functionName: "priceOf",
        args: [current],
        chainId: FUJI_CHAIN_ID,
      });
      const approved = await readContract(wagmiConfig, {
        address: tokenAddress,
        abi: cptTokenAbi,
        functionName: "allowance",
        args: [address, upgradesAddress],
        chainId: FUJI_CHAIN_ID,
      });
      if (approved < price) {
        setBusy(`upgrade:${id}:approve`);
        const approveHash = await writeContractAsync({
          address: tokenAddress,
          abi: cptTokenAbi,
          functionName: "approve",
          args: [upgradesAddress, price],
          chainId: FUJI_CHAIN_ID,
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }
      setBusy(`upgrade:${id}:buy`);
      const hash = await writeContractAsync({
        address: upgradesAddress,
        abi: upgradesAbi,
        functionName: "purchase",
        args: [index],
        chainId: FUJI_CHAIN_ID,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      try {
        await api<GameState>("/api/game/upgrades/refresh", { method: "POST" });
      } catch (error) {
        setBanner(
          readableError(
            error,
            "The upgrade landed on Fuji. This booth will show the shorter cooldown within 15 seconds.",
          ),
        );
      }
      await Promise.all([stateQuery.refetch(), balance.refetch(), allowance.refetch()]);
    } catch (error) {
      setBanner(readableError(error, "Upgrade failed."));
      await stateQuery.refetch();
    } finally {
      setBusy(null);
    }
  }

  async function claim() {
    if (!address || !walletMatches) {
      setBanner("Connect the same wallet you signed in with to mint CPT.");
      return;
    }
    setBusy("claim");
    setBanner(null);
    try {
      if (!onFuji) {
        await switchChainAsync({ chainId: FUJI_CHAIN_ID });
      }
      const { claim: payload } = await api<ClaimResponse>("/api/game/claim", { method: "POST" });
      const hash = await writeContractAsync({
        address: payload.pizzaRewards,
        abi: pizzaRewardsAbi,
        functionName: "claim",
        args: [
          payload.user,
          BigInt(payload.amountWei),
          BigInt(payload.nonce),
          BigInt(payload.deadline),
          payload.signature,
        ],
        chainId: FUJI_CHAIN_ID,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      await api("/api/game/claim/confirm", {
        method: "POST",
        body: JSON.stringify({ txHash: hash }),
      });
      await stateQuery.refetch();
      await balance.refetch();
    } catch (error) {
      setBanner(readableError(error, "Claim failed."));
      await stateQuery.refetch();
    } finally {
      setBusy(null);
    }
  }

  const pending = state?.pendingCpt ?? "0";
  const openAmount = state?.openClaim?.amount ?? null;
  const canClaim = Boolean(sessionAddress) && (openAmount !== null || pending !== "0");
  const claimLabel = openAmount
    ? `Mint ${openAmount} CPT`
    : pending !== "0"
      ? `Claim ${pending} CPT`
      : "Nothing to claim";

  return (
    <div className="relative z-10 min-h-screen">
      <header className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.32em] text-accent">
            <Link href="/" className="hover:underline focus-visible:underline">
              STREET
            </Link>
            <span aria-hidden> · </span>
            AVALANCHE FUJI · 43113
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">CyberPizza</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Night-shift kitchen. Scrape toppings, bake from the menu, spend CPT to cool trays faster.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sessionAddress ? (
            <Badge variant="outline" className="font-mono">
              Shift {shortAddress(sessionAddress)}
            </Badge>
          ) : null}
          {sessionAddress ? (
            <Button variant="outline" type="button" onClick={() => void signOut()} disabled={busy === "sign-out"}>
              Sign out
            </Button>
          ) : null}
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-16 sm:px-6">
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            ["01", "Connect", "A wallet on Avalanche Fuji. Testnet AVAX pays the mint."],
            ["02", "Sign the slip", "SIWE opens your shift. The signature does not spend gas."],
            ["03", "Bake and claim", "Pick a recipe. Pending CPT is the menu price, then you mint it."],
          ].map(([step, title, copy]) => (
            <li key={step} className="stall-panel rounded-2xl px-4 py-3">
              <p className="font-mono text-[11px] text-accent">{step}</p>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-muted-foreground">{copy}</p>
            </li>
          ))}
        </ol>

        {banner ? (
          <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            {banner}
          </p>
        ) : null}

        {sessionQuery.isError ? (
          <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            {sessionQuery.error instanceof Error
              ? sessionQuery.error.message
              : "Could not read the booth session."}
          </p>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="stall-panel flex flex-col items-center justify-center rounded-3xl p-6">
            <PizzaMark className="size-52 sm:size-60" />
            <p className="mt-4 text-center font-mono text-xs tracking-wide text-muted-foreground">
              {RECIPES.length} recipes · Neon Supreme still pays 10 CPT
            </p>
          </div>

          <Card className="stall-panel ring-0">
            <CardHeader>
              <CardTitle className="text-xl">The pass</CardTitle>
              <CardDescription>
                {sessionAddress
                  ? "Amounts are decided on the server. The wallet only mints what the booth already signed."
                  : "The trays stay locked until you sign in. Cooldowns and caps are posted so you can plan the shift."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!sessionAddress ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  {isConnected ? (
                    <Button type="button" className="h-11 px-4" onClick={() => void signIn()} disabled={busy === "sign-in"}>
                      {busy === "sign-in" ? "Waiting for signature…" : "Sign the booth slip"}
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">Connect a wallet to clock in.</p>
                  )}
                </div>
              ) : (
                <>
                  {stateQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Opening your trays…</p>
                  ) : null}
                  {stateQuery.isError ? (
                    <p role="alert" className="text-sm text-destructive">
                      {stateQuery.error instanceof Error
                        ? stateQuery.error.message
                        : "Could not load the shift."}
                    </p>
                  ) : null}
                  {sessionAddress && address && !walletMatches ? (
                    <p className="text-sm text-primary">
                      This wallet is not the signed-in shift. Sign in again to switch cooks.
                    </p>
                  ) : null}
                  {isConnected && !onFuji ? (
                    <p className="text-sm text-primary">Switch the wallet to Avalanche Fuji before you mint.</p>
                  ) : null}
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat label="Pending CPT" value={state ? pending : "—"} />
                    <Stat label="Pies baked" value={state ? String(state.pizzasBaked) : "—"} />
                    <Stat label="Next nonce" value={state ? state.claimNonce : "—"} />
                    <Stat
                      label="Wallet CPT"
                      value={balance.data !== undefined ? formatToken(balance.data) : state?.contracts.deployed ? "…" : "—"}
                    />
                  </dl>
                  {state?.openClaim && state.pendingCpt !== "0" ? (
                    <p className="text-sm text-muted-foreground">
                      An open claim for {state.openClaim.amount} CPT is waiting on Fuji.{" "}
                      {state.pendingCpt} more CPT stays in the till until that mint confirms.
                    </p>
                  ) : null}
                  {state && !state.contracts.deployed ? (
                    <p className="text-sm text-muted-foreground">
                      Contracts are not deployed yet. You can still collect and bake. Minting turns on after Fuji
                      addresses are set.
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-11 px-4"
                      disabled={
                        !canClaim ||
                        busy !== null ||
                        !state?.contracts.deployed ||
                        (Boolean(address) && !walletMatches)
                      }
                      onClick={() => void claim()}
                    >
                      {busy === "claim" ? "Minting…" : claimLabel}
                    </Button>
                    <Button type="button" variant="ghost" className="h-11" onClick={() => void refresh()}>
                      Refresh
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        <RecipeMenu
          recipes={recipes}
          signedIn={Boolean(sessionAddress)}
          busy={busy}
          onBake={(recipeId) => void bake(recipeId)}
        />

        <section>
          <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <h2 className="text-xl font-semibold">Topping trays</h2>
            <p className="font-mono text-xs text-pretty text-muted-foreground md:text-right">
              Server cooldown · hard cap
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {inventory.map((item) => {
              const live = Boolean(state);
              const label = cooldownLabel(item, now, live);
              const cooled = live && (now === null ? item.ready : label === "Ready");
              const full = live && item.amount >= item.cap;
              return (
                <Card key={item.id} className="stall-panel ring-0">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{item.name}</CardTitle>
                        <CardDescription>{item.blurb}</CardDescription>
                      </div>
                      <span
                        className="mt-1 size-3 shrink-0 rounded-full"
                        style={{ background: item.accent, boxShadow: `0 0 12px ${item.accent}` }}
                        aria-hidden
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-lg">
                        {live ? item.amount : "—"}
                        <span className="text-sm text-muted-foreground">/{item.cap}</span>
                      </p>
                      <p className="font-mono text-xs text-muted-foreground" aria-live="polite">
                        {label}
                        {live && item.upgradeLevel > 0 ? ` · L${item.upgradeLevel} · ${item.cooldownSeconds}s` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={cooled && !full ? "default" : "outline"}
                      disabled={!sessionAddress || !cooled || full || busy !== null}
                      onClick={() => void collect(item.id)}
                    >
                      {busy === item.id ? "Grabbing…" : full ? "Full" : "Collect"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <UpgradeShop
          inventory={inventory}
          signedIn={Boolean(sessionAddress)}
          canBuy={Boolean(sessionAddress) && walletMatches && contracts.upgradesDeployed}
          deployed={contracts.upgradesDeployed}
          allowance={allowance.data}
          busy={busy}
          onBuy={(id) => void buyUpgrade(id)}
        />
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/20 px-3 py-2">
      <dt className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  );
}
