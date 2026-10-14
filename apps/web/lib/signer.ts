import {
  CLAIM_TYPES,
  EIP712_NAME,
  EIP712_VERSION,
  FUJI_CHAIN_ID,
} from "@cyberpizza/shared";
import { getAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getContracts } from "./contracts";
import { GameError } from "./errors";

export type ClaimMessage = {
  user: Address;
  amount: bigint;
  nonce: bigint;
  deadline: bigint;
};

function signerKey(): Hex {
  const raw = process.env.SIGNER_PRIVATE_KEY?.trim() ?? "";
  const key = raw.startsWith("0x") ? raw : raw ? `0x${raw}` : "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new GameError(
      503,
      "signer_not_configured",
      "SIGNER_PRIVATE_KEY must be the 32-byte key whose address is PizzaRewards.signer.",
    );
  }
  return key as Hex;
}

export function assertSignerConfigured() {
  signerKey();
  const contracts = getContracts();
  if (!contracts.deployed) {
    throw new GameError(
      409,
      "contracts_not_deployed",
      "Deploy CPTToken and PizzaRewards to Fuji, then set the public addresses.",
    );
  }
  return contracts;
}

export async function signClaim(message: ClaimMessage) {
  const contracts = assertSignerConfigured();
  const account = privateKeyToAccount(signerKey());
  const signature = await account.signTypedData({
    domain: {
      name: EIP712_NAME,
      version: EIP712_VERSION,
      chainId: FUJI_CHAIN_ID,
      verifyingContract: getAddress(contracts.pizzaRewards),
    },
    types: CLAIM_TYPES,
    primaryType: "Claim",
    message,
  });
  return { signature, contracts, signer: account.address };
}
