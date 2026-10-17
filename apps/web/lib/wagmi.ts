import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { avalancheFuji } from "wagmi/chains";

/**
 * Browser-extension wallets only. `injectedWallet` is window.ethereum.
 * Wagmi's EIP-6963 discovery (on by default) adds each announced provider —
 * MetaMask, Core, Rabby, and any other injected wallet — as its own connector.
 * WalletConnect is not registered, so nothing talks to the relay and no
 * Reown project id is required. `projectId` is still a required argument of
 * `connectorsForWallets`; the empty string is never read by the injected wallet.
 */
const connectors = connectorsForWallets(
  [
    {
      groupName: "Installed",
      wallets: [injectedWallet],
    },
  ],
  {
    appName: "CyberPizza",
    projectId: "",
  },
);

export const wagmiConfig = createConfig({
  chains: [avalancheFuji],
  connectors,
  multiInjectedProviderDiscovery: true,
  ssr: true,
  transports: {
    [avalancheFuji.id]: http(),
  },
});
