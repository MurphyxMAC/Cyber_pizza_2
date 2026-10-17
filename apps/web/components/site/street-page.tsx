import { KitchenScene } from "@/components/site/kitchen-scene";
import { PixelImage } from "@/components/site/pixel-image";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { ToppingArt } from "@/components/site/topping-art";
import { DISCORD_URL, GITHUB_URL } from "@/lib/site";
import { OVEN_TIERS, SHEET_EXTRAS } from "@/lib/pixel-art";
import {
  CPT_DECIMALS,
  DEFAULT_CLAIM_DEADLINE_SECONDS,
  DEFAULT_DAILY_MINT_CAP_CPT,
  EIP712_NAME,
  EIP712_VERSION,
  FUJI_CHAIN_ID,
  INGREDIENTS,
  PIZZA_CPT_REWARD,
  RECIPE_ID,
  RECIPE_NAME,
} from "@cyberpizza/shared";
import Link from "next/link";
import type { ReactNode } from "react";

const primaryCta =
  "inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const secondaryCta =
  "inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background/50 px-5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const slowest = INGREDIENTS.reduce((current, item) =>
  item.cooldownSeconds > current.cooldownSeconds ? item : current,
);

const shiftSteps = [
  ["01", "Connect", "A wallet on Avalanche Fuji. Testnet AVAX pays the mint."],
  ["02", "Sign the slip", "SIWE opens your shift. The signature does not spend gas."],
  ["03", "Bake and claim", `One of each topping makes a pie worth ${PIZZA_CPT_REWARD} pending CPT.`],
] as const;

const flow = [
  `${INGREDIENTS.length} toppings`,
  RECIPE_NAME,
  `${PIZZA_CPT_REWARD} pending CPT`,
  `ERC-20 on Fuji`,
] as const;

export function StreetPage() {
  return (
    <div>
      <SiteHeader />
      <main id="content">
        <section className="mx-auto grid w-full max-w-7xl items-center gap-10 overflow-x-clip px-4 py-12 sm:px-6 xl:grid-cols-[minmax(0,1fr)_512px] xl:py-16">
            <div className="order-2 xl:order-1">
              <p className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-black/25 px-3 py-1 font-mono text-[11px] tracking-[0.22em] text-accent">
                <span className="site-pulse size-1.5 rounded-full bg-accent" aria-hidden />
                Fuji testnet · chain {FUJI_CHAIN_ID}
              </p>
              <h1 className="font-pixel mt-5 max-w-xl text-4xl font-bold text-balance sm:text-5xl">
                Bake one neon pie.
                <span className="mt-2 block text-primary">Mint the CPT.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
                Collect {INGREDIENTS.length} toppings, bake a {RECIPE_NAME} for {PIZZA_CPT_REWARD} pending CPT, then
                claim that balance on-chain as ERC-20 CPT.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/play" className={primaryCta}>
                  Enter the kitchen
                </Link>
                <a href={DISCORD_URL} className={secondaryCta} target="_blank" rel="noopener noreferrer">
                  Join the Discord
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
              <dl className="mt-8 grid max-w-lg grid-cols-3 gap-3">
                <Fact label="Toppings" value={String(INGREDIENTS.length)} />
                <Fact label="Per pie" value={`${PIZZA_CPT_REWARD} CPT`} />
                <Fact label="Network" value="Fuji" />
              </dl>
            </div>
            <div className="order-1 xl:order-2">
              <KitchenScene />
            </div>
        </section>

        <div className="overflow-hidden border-y border-border/70" aria-hidden="true">
          <div className="site-marquee flex py-3 font-mono text-xs tracking-[0.22em] text-muted-foreground">
            <ToppingTicker />
            <ToppingTicker className="site-marquee-clone" />
          </div>
        </div>

        <Section id="shift" kicker="The shift" title="Clock in, then cook.">
          <p className="max-w-2xl text-pretty text-muted-foreground">
            The street and the booth use the same three steps. Nothing here is a score, a season, or a drop.
          </p>
          <ol className="mt-8 grid gap-3 sm:grid-cols-3">
            {shiftSteps.map(([step, title, copy]) => (
              <li key={step} className="stall-panel rounded-2xl px-4 py-4">
                <p className="font-mono text-[11px] tracking-[0.2em] text-accent">{step}</p>
                <h3 className="mt-1 text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-pretty text-muted-foreground">{copy}</p>
              </li>
            ))}
          </ol>
          <ol className="mt-4 grid gap-3 sm:grid-cols-4">
            {flow.map((item, index) => (
              <li key={item} className="stall-panel flex items-center gap-3 rounded-2xl px-4 py-3">
                <span className="font-mono text-[11px] text-accent">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-sm font-medium">{item}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="rules" kicker="House rules" title="The server keeps the till.">
          <div className="grid gap-3 md:grid-cols-2">
            <Rule title="Amounts are not a client choice">
              Collect, bake, and claim amounts are computed in Postgres from the shared constants. The wallet only
              mints what the booth already signed.
            </Rule>
            <Rule title={`One recipe: ${RECIPE_NAME}`}>
              Baking consumes 1 of each topping and adds {PIZZA_CPT_REWARD} pending CPT. The recipe id is {RECIPE_ID}.
            </Rule>
            <Rule title={`${slowest.name} sets the pace`}>
              If you start from empty, the first pie waits on the slowest tray: {slowest.name},{" "}
              {slowest.cooldownSeconds} seconds. Each collect is one topping, capped, and cooldown-gated.
            </Rule>
            <Rule title="An open claim holds the nonce">
              Until Fuji confirms the mint, the next request reuses that claim. CPT earned during an open claim waits
              for the next slip.
            </Rule>
          </div>
        </Section>

        <Section id="toppings" kicker="Topping trays" title="Nine trays. Server cooldown. Hard cap.">
          <p className="max-w-2xl text-pretty text-muted-foreground">
            Names, blurbs, cooldowns, and caps are the same list the kitchen posts before you sign in.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {INGREDIENTS.map((ingredient) => (
              <li key={ingredient.id} className="site-card stall-panel relative flex gap-3 overflow-hidden rounded-2xl p-3 pl-4">
                <span
                  className="absolute top-3 bottom-3 left-0 w-1"
                  style={{ background: ingredient.accent, boxShadow: `0 0 12px ${ingredient.accent}` }}
                  aria-hidden
                />
                <ToppingArt id={ingredient.id} name={ingredient.name} accent={ingredient.accent} scale={2} />
                <div className="min-w-0">
                  <h3 className="font-pixel text-sm font-bold">{ingredient.name}</h3>
                  <p className="mt-1 text-sm text-pretty text-muted-foreground">{ingredient.blurb}</p>
                  <p className="mt-3 font-mono text-xs tracking-wide text-muted-foreground">
                    {ingredient.cooldownSeconds}s cooldown · cap {ingredient.cap}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 stall-panel rounded-2xl p-4">
            <p className="font-mono text-[11px] tracking-[0.22em] text-accent">SHEET NOTES</p>
            <p className="mt-2 max-w-3xl text-sm text-pretty text-muted-foreground">
              Cheese, pepperoni, mushrooms, and holo basil use matching tiles. Neon tomatoes use the tomato-sauce tile.
              Nano peppers use the green-pepper tile. Cybertruffles, quantum cheese, and cyberbacon have no matching
              tile, so those trays keep the accent dot.
            </p>
            <ul className="mt-4 flex flex-wrap gap-4">
              {SHEET_EXTRAS.map((extra) => (
                <li key={extra.tile} className="flex flex-col gap-1">
                  <PixelImage src={extra.src} alt="" native={64} />
                  <span className="font-mono text-[10px] tracking-wide text-muted-foreground">
                    {extra.tile} · not a topping
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section id="ovens" kicker="Oven tiers · not live" title="Three ovens. None of them bake yet.">
          <p className="max-w-2xl text-pretty text-muted-foreground">
            The sheet shows a stone hearth, a neon-chrome deck, and a plasma core. The idea is an upgrade where each
            tier shortens bake time or slightly raises pending CPT. Those rates are not in the repository. The booth
            still bakes one {RECIPE_NAME} for {PIZZA_CPT_REWARD} pending CPT, with no oven upgrade.
          </p>
          <figure className="pixel-stage mt-8">
            <div className="pixel-frame mx-auto w-fit max-w-full">
              <PixelImage
                src="/pixel/oven-tiers.png"
                alt="Three pizza ovens side by side: a stone hearth, a neon-chrome deck, and a plasma core."
                native={256}
                scale={2}
                className="hidden sm:block"
              />
              <PixelImage
                src="/pixel/oven-tiers.png"
                alt="Three pizza ovens side by side: a stone hearth, a neon-chrome deck, and a plasma core."
                native={256}
                className="sm:hidden"
              />
            </div>
            <figcaption className="sr-only">Concept art. Not a live upgrade.</figcaption>
          </figure>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {OVEN_TIERS.map((tier, index) => (
              <li key={tier.name} className="stall-panel rounded-2xl px-4 py-3">
                <p className="font-mono text-[11px] tracking-[0.2em] text-primary">Not live · 0{index + 1}</p>
                <h3 className="font-pixel mt-1 text-sm font-bold">{tier.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{tier.blurb}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="claim" kicker="The claim" title="Pending CPT, then a Fuji transaction.">
          <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="pixel-stage pixel-frame">
              <PixelImage
                src="/pixel/pizza.png"
                alt="Top-down Neon Supreme, a round baked pizza."
                native={256}
              />
            </div>
            <p className="max-w-md text-sm text-pretty text-muted-foreground">
              {RECIPE_NAME}, drawn as a baked pie. One of each topping. {PIZZA_CPT_REWARD} pending CPT. The picture is
              art, not a photo of a minted claim.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
            <ol className="grid gap-3">
              {[
                ["Bake", `The server adds ${PIZZA_CPT_REWARD} pending CPT and drops one of each topping. The wallet stays quiet.`],
                [
                  "Sign",
                  `The booth signs an EIP-712 Claim for the full pending balance, the nonce, and a deadline. Default lifetime is ${DEFAULT_CLAIM_DEADLINE_SECONDS / 60} minutes.`,
                ],
                [
                  "Mint",
                  "The wallet sends PizzaRewards.claim on Fuji. You need a little testnet AVAX for gas. After the receipt, the booth confirms the Claimed event.",
                ],
              ].map(([title, copy], index) => (
                <li key={title} className="stall-panel rounded-2xl px-4 py-4">
                  <p className="font-mono text-[11px] tracking-[0.2em] text-accent">{String(index + 1).padStart(2, "0")}</p>
                  <h3 className="mt-1 font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-pretty text-muted-foreground">{copy}</p>
                </li>
              ))}
            </ol>
            <dl className="stall-panel grid content-start gap-4 rounded-3xl p-5 sm:grid-cols-2 lg:grid-cols-1">
              <FactRow label="Token" value={`CyberPizza Token (CPT), ${CPT_DECIMALS} decimals, from CPTToken`} />
              <FactRow label="Chain" value={`Avalanche Fuji · ${FUJI_CHAIN_ID}`} />
              <FactRow label="Domain" value={`${EIP712_NAME} · version ${EIP712_VERSION}`} />
              <FactRow
                label="Daily mint cap"
                value={`${DEFAULT_DAILY_MINT_CAP_CPT.toLocaleString("en-US")} CPT default, per 24 hours. The owner can change it.`}
              />
              <FactRow
                label="Deployed addresses"
                value="The checked-in Fuji file still uses the zero address. Minting stays off until a deploy writes real addresses."
              />
              <FactRow label="Burn" value="Holders can burn CPT. Only the minter role can mint." />
            </dl>
          </div>
        </Section>

        <Section id="about" kicker="About this booth" title="Phase 0 and Phase 1, from scratch.">
          <p className="max-w-2xl text-pretty text-muted-foreground">
            This repository is a from-scratch build: Foundry contracts, Supabase-compatible Postgres, and a Next.js booth. The previous CyberPizza repo is inspiration only. A later public roadmap is not checked in.
          </p>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <article className="stall-panel rounded-3xl p-5">
              <h3 className="font-mono text-[11px] tracking-[0.22em] text-accent">In the repository</h3>
              <ul className="mt-4 flex flex-col gap-3 text-sm">
                <li>CPTToken and PizzaRewards, Forge tests, and a Fuji deploy script that refuses any other chain.</li>
                <li>Postgres tables for users, inventory, recipes, claims, and an actions log.</li>
                <li>The Next.js booth: wallet connect, SIWE, collect, bake, and claim.</li>
                <li>
                  {INGREDIENTS.length} toppings with server cooldowns and caps, and the {RECIPE_NAME} recipe for{" "}
                  {PIZZA_CPT_REWARD} pending CPT.
                </li>
              </ul>
            </article>
            <article className="stall-panel rounded-3xl p-5">
              <h3 className="font-mono text-[11px] tracking-[0.22em] text-primary">Not in the repository</h3>
              <ul className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
                <li>A Supabase project, a funded Fuji wallet, or a private key.</li>
                <li>A session secret, a signer key, or a WalletConnect Cloud project id.</li>
                <li>Deployed contract addresses. fuji.json is still the zero address.</li>
                <li>Player counts, a changelog, or a published roadmap.</li>
                <li>A screenshot of a played shift. The pictures here are pixel art, not a session capture.</li>
                <li>Oven tiers. The art is on this page. Bake time and CPT do not change with an oven.</li>
              </ul>
            </article>
          </div>
        </Section>

        <Section id="community" kicker="Community" title="The night shift hangs out on Discord.">
          <div className="stall-panel relative overflow-hidden rounded-3xl px-6 py-10 sm:px-10">
            <div className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-primary/25 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-24 -left-10 size-56 rounded-full bg-accent/15 blur-3xl" aria-hidden />
            <div className="relative max-w-2xl">
              <p className="text-pretty text-muted-foreground">
                The repository publishes an invite and nothing else. No member count, event calendar, or social feed is checked in.
              </p>
              <p className="mt-4 font-mono text-sm tracking-wide text-accent">discord.gg/6y9mjEFRts</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a href={DISCORD_URL} className={primaryCta} target="_blank" rel="noopener noreferrer">
                  Join the Discord
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                <a href={GITHUB_URL} className={secondaryCta} target="_blank" rel="noopener noreferrer">
                  Read the source
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
            </div>
          </div>
        </Section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({
  id,
  kicker,
  title,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="font-mono text-[11px] tracking-[0.32em] text-accent uppercase">{kicker}</p>
        <h2 id={headingId} className="font-pixel mt-2 max-w-3xl text-2xl font-bold text-balance sm:text-3xl">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2">
      <dt className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-sm text-pretty">{value}</dd>
    </div>
  );
}

function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="site-card stall-panel rounded-2xl p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">{children}</p>
    </article>
  );
}

function ToppingTicker({ className = "" }: { className?: string }) {
  return (
    <div className={`flex shrink-0 gap-8 pr-8 ${className}`}>
      {INGREDIENTS.map((ingredient) => (
        <span key={`${className}-${ingredient.id}`} className="inline-flex items-center gap-2">
          <span className="size-1.5 rounded-full" style={{ background: ingredient.accent }} />
          {ingredient.name}
        </span>
      ))}
    </div>
  );
}
