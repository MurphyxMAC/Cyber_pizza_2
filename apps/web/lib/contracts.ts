import { resolveAddresses } from "@cyberpizza/shared";

export function getContracts() {
  return resolveAddresses({
    cptToken: process.env.NEXT_PUBLIC_CPT_TOKEN_ADDRESS,
    pizzaRewards: process.env.NEXT_PUBLIC_PIZZA_REWARDS_ADDRESS,
    upgrades: process.env.NEXT_PUBLIC_UPGRADES_ADDRESS,
  });
}
