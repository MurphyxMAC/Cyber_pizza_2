import { pizzaRewardsAbi } from "@cyberpizza/shared";
import { getAddress, isAddressEqual, type Hex } from "viem";
import { parseEventLogs } from "viem";
import { fujiClient } from "./chain";
import { getContracts } from "./contracts";
import { getSql } from "./db";
import { GameError } from "./errors";
import { getGameState } from "./game";

export async function confirmClaim(address: string, txHash: Hex) {
  const contracts = getContracts();
  if (!contracts.deployed) {
    throw new GameError(409, "contracts_not_deployed", "Rewards contract address is not configured.");
  }

  const client = fujiClient();
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch {
    throw new GameError(
      409,
      "receipt_pending",
      "Fuji has not returned that receipt yet. Wait for the transaction and try again.",
    );
  }

  if (receipt.status !== "success") {
    throw new GameError(409, "tx_failed", "That transaction reverted on Fuji.");
  }
  if (!isAddressEqual(receipt.from, getAddress(address))) {
    throw new GameError(403, "wrong_sender", "That transaction was not sent by the signed-in wallet.");
  }

  const events = parseEventLogs({
    abi: pizzaRewardsAbi,
    logs: receipt.logs,
    eventName: "Claimed",
  }).filter((event) => isAddressEqual(event.address, getAddress(contracts.pizzaRewards)));

  const match = events.find((event) => isAddressEqual(event.args.user, getAddress(address)));
  if (!match) {
    throw new GameError(409, "claim_event_missing", "That transaction did not mint CPT for this wallet.");
  }

  await getSql()`select confirm_claim(${address}, ${match.args.nonce.toString()}::bigint, ${txHash})`;
  return getGameState(address);
}
