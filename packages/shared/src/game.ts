import type { IngredientId } from "./constants";

export type OpenClaim = {
  id: string;
  amount: string;
  amountWei: string;
  nonce: string;
  deadline: string;
  signature: `0x${string}` | null;
  status: "pending";
};

export type IngredientState = {
  id: IngredientId;
  name: string;
  blurb: string;
  accent: string;
  amount: number;
  cap: number;
  cooldownSeconds: number;
  lastCollectedAt: string | null;
  readyAt: string | null;
  ready: boolean;
};

export type GameState = {
  address: string;
  pendingCpt: string;
  claimNonce: string;
  pizzasBaked: number;
  serverNow: string;
  inventory: IngredientState[];
  recipe: {
    id: string;
    name: string;
    cptReward: string;
    canBake: boolean;
    missing: string[];
  };
  openClaim: OpenClaim | null;
  contracts: {
    deployed: boolean;
    cptToken: string;
    pizzaRewards: string;
  };
};

export type ClaimPayload = {
  user: `0x${string}`;
  amount: string;
  amountWei: string;
  nonce: string;
  deadline: string;
  signature: `0x${string}`;
  pizzaRewards: `0x${string}`;
  chainId: number;
};
