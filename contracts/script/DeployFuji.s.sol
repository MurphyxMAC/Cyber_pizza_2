// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {CPTToken} from "../src/CPTToken.sol";
import {PizzaRewards} from "../src/PizzaRewards.sol";
import {Upgrades} from "../src/Upgrades.sol";

/// @notice Deploys CPTToken, PizzaRewards, and Upgrades to Avalanche Fuji and writes deployments/fuji.json.
/// @dev Required env: PRIVATE_KEY (0x-prefixed).
///      Optional: SIGNER_ADDRESS, TREASURY_ADDRESS (defaults to the deployer), DAILY_MINT_CAP_CPT (whole tokens).
///      Upgrade purchases burn 50% of the CPT and send 50% to TREASURY_ADDRESS.
contract DeployFuji is Script {
    uint256 internal constant FUJI_CHAIN_ID = 43113;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address signer = vm.envOr("SIGNER_ADDRESS", deployer);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);
        uint256 dailyCapCpt = vm.envOr("DAILY_MINT_CAP_CPT", uint256(10_000));
        uint256 dailyCap = dailyCapCpt * 1 ether;

        if (block.chainid != FUJI_CHAIN_ID) {
            revert("DeployFuji: expected chain id 43113 (Avalanche Fuji)");
        }

        bytes32 minterRole = keccak256("MINTER_ROLE");

        vm.startBroadcast(deployerKey);

        CPTToken token = new CPTToken(deployer);
        PizzaRewards rewards = new PizzaRewards(address(token), signer, deployer, dailyCap);
        Upgrades toppingUpgrades = new Upgrades(address(token), treasury, deployer);
        token.grantRole(minterRole, address(rewards));

        vm.stopBroadcast();

        console2.log("CPTToken", address(token));
        console2.log("PizzaRewards", address(rewards));
        console2.log("Upgrades", address(toppingUpgrades));
        console2.log("Signer", signer);
        console2.log("Treasury", treasury);
        console2.log("Daily cap CPT", dailyCapCpt);

        string memory json = "fuji";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "cptToken", address(token));
        vm.serializeAddress(json, "pizzaRewards", address(rewards));
        vm.serializeAddress(json, "upgrades", address(toppingUpgrades));
        vm.serializeAddress(json, "deployer", deployer);
        vm.serializeAddress(json, "signer", signer);
        vm.serializeAddress(json, "treasury", treasury);
        string memory out = vm.serializeUint(json, "dailyMintCap", dailyCap);

        vm.writeJson(out, "deployments/fuji.json");
        vm.writeJson(out, "../packages/shared/src/deployments/fuji.json");
    }
}
