import { createPublicClient, http } from "viem";
import { avalancheFuji } from "viem/chains";

const globalForChain = globalThis as unknown as {
  cyberpizzaFuji?: ReturnType<typeof createPublicClient>;
};

export function fujiClient() {
  if (!globalForChain.cyberpizzaFuji) {
    globalForChain.cyberpizzaFuji = createPublicClient({
      chain: avalancheFuji,
      transport: http(process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc"),
    });
  }
  return globalForChain.cyberpizzaFuji;
}
