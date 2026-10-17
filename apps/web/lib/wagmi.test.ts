import assert from "node:assert/strict";
import test from "node:test";
import { wagmiConfig } from "./wagmi";

test("wallet config registers injected connectors and not WalletConnect", () => {
  assert.equal(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID, undefined);
  const connectors = wagmiConfig.connectors.map((connector) => {
    const details = connector as { id: string; rkDetails?: { id?: string; name?: string } };
    return { id: details.id, rainbowId: details.rkDetails?.id, name: details.rkDetails?.name };
  });

  assert.ok(connectors.some((connector) => connector.id === "injected" || connector.rainbowId === "injected"));
  assert.equal(
    connectors.some(
      (connector) =>
        connector.id === "walletConnect" ||
        connector.rainbowId === "walletConnect" ||
        /walletconnect/i.test(connector.name ?? ""),
    ),
    false,
  );
});
