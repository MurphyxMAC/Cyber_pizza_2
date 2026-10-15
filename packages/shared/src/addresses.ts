import fujiDeployment from "./deployments/fuji.json";
import { isDeployedAddress } from "./constants";

export { fujiDeployment };

export type ContractAddresses = {
  cptToken: `0x${string}`;
  pizzaRewards: `0x${string}`;
  deployed: boolean;
};

/**
 * Env overrides win over deployments/fuji.json so a local web env can point at
 * a fresh deploy without editing the package.
 */
export function resolveAddresses(env: {
  cptToken?: string | undefined;
  pizzaRewards?: string | undefined;
} = {}): ContractAddresses {
  const cptToken = (env.cptToken || fujiDeployment.cptToken) as `0x${string}`;
  const pizzaRewards = (env.pizzaRewards || fujiDeployment.pizzaRewards) as `0x${string}`;
  return {
    cptToken,
    pizzaRewards,
    deployed: isDeployedAddress(cptToken) && isDeployedAddress(pizzaRewards),
  };
}
