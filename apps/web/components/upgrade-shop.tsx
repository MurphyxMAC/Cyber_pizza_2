"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  UPGRADE_BURN_BPS,
  UPGRADE_LEVEL_PRICES_CPT,
  UPGRADE_MAX_LEVEL,
  UPGRADE_MIN_COOLDOWN_BPS,
  UPGRADE_REDUCTION_BPS_PER_LEVEL,
  upgradePriceWei,
  type IngredientId,
  type IngredientState,
} from "@cyberpizza/shared";

function buyLabel(item: IngredientState, busy: string | null, allowance?: bigint) {
  if (busy === `upgrade:${item.id}:approve`) return "Approving…";
  if (busy === `upgrade:${item.id}:buy` || busy === `upgrade:${item.id}`) return "Buying…";
  if (!item.upgradePriceCpt) return "Maxed";
  const price = upgradePriceWei(item.upgradeLevel);
  if (price !== null && allowance !== undefined && allowance >= price) {
    return `Buy · ${item.upgradePriceCpt} CPT`;
  }
  return `Approve and buy · ${item.upgradePriceCpt} CPT`;
}

export function UpgradeShop({
  inventory,
  signedIn,
  canBuy,
  deployed,
  allowance,
  busy,
  onBuy,
}: {
  inventory: IngredientState[];
  signedIn: boolean;
  canBuy: boolean;
  deployed: boolean;
  allowance?: bigint;
  busy: string | null;
  onBuy: (id: IngredientId) => void;
}) {
  const burnPercent = UPGRADE_BURN_BPS / 100;
  const keepPercent = 100 - burnPercent;
  const cutPercent = UPGRADE_REDUCTION_BPS_PER_LEVEL / 100;
  const floorPercent = UPGRADE_MIN_COOLDOWN_BPS / 100;

  return (
    <section aria-labelledby="upgrade-shop-heading">
      <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <h2 id="upgrade-shop-heading" className="text-xl font-semibold">
          Cooldown upgrades
        </h2>
        <p className="font-mono text-xs text-pretty text-muted-foreground md:text-right">
          Prices {UPGRADE_LEVEL_PRICES_CPT.join(" / ")} CPT
        </p>
      </div>
      <p className="mb-3 max-w-3xl text-sm text-pretty text-muted-foreground">
        Each level cuts {cutPercent}% of that topping&apos;s base cooldown, down to {floorPercent}% at level{" "}
        {UPGRADE_MAX_LEVEL}. The wallet approves CPT, then <span className="font-mono">purchase</span> pulls it.
        {burnPercent}% is burned and {keepPercent}% goes to the treasury. The booth reads your level from Fuji. It
        ignores any level sent from the browser.
      </p>
      {!signedIn ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Sign in and mint CPT before these buttons can spend it. The prices and next cooldowns are posted anyway.
        </p>
      ) : null}
      {signedIn && !deployed ? (
        <p className="mb-3 text-sm text-muted-foreground">
          The upgrades contract is not deployed yet. Cooldowns stay at the base times until a Fuji address is set.
        </p>
      ) : null}
      {signedIn && deployed && !canBuy ? (
        <p className="mb-3 text-sm text-primary">Connect the signed-in wallet on Avalanche Fuji to buy.</p>
      ) : null}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {inventory.map((item) => {
          const maxed = item.upgradePriceCpt === null;
          return (
            <li key={item.id}>
              <Card className="stall-panel h-full ring-0">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{item.name}</CardTitle>
                      <CardDescription>
                        Level {item.upgradeLevel}/{UPGRADE_MAX_LEVEL}
                      </CardDescription>
                    </div>
                    <span
                      className="mt-1 size-3 shrink-0 rounded-full"
                      style={{ background: item.accent, boxShadow: `0 0 12px ${item.accent}` }}
                      aria-hidden
                    />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col items-start gap-3">
                  <p className="font-mono text-xs text-muted-foreground">
                    {item.cooldownSeconds}s now
                    {item.nextCooldownSeconds !== null ? ` → ${item.nextCooldownSeconds}s next` : " · maxed"}
                  </p>
                  <Button
                    type="button"
                    variant={maxed ? "outline" : "default"}
                    disabled={!canBuy || maxed || busy !== null}
                    onClick={() => onBuy(item.id)}
                  >
                    {buyLabel(item, busy, allowance)}
                  </Button>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
