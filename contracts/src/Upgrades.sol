// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CPTToken} from "./CPTToken.sol";

/// @title Upgrades
/// @notice Sells per-ingredient cooldown levels for CPT. The buyer is msg.sender.
/// @dev Ingredient ids are 0..8 and MUST stay aligned with packages/shared INGREDIENTS:
///      0 cheese, 1 pepperoni, 2 mushrooms, 3 cybertruffles, 4 neontomatoes,
///      5 holobasil, 6 quantumcheese, 7 nanopeppers, 8 cyberbacon.
///      Forty levels. Unweighted price starts at 20 CPT and rises by 20 CPT per level.
///      A rarity weight scales that price (cheese 1×, cyber bacon 2.2×). Half of every
///      price is burned. The other half is transferred to `treasury`. Cooldown math
///      lives off-chain (2% of base per level, floor 20%); this contract only stores
///      the level the server reads.
contract Upgrades is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 public constant INGREDIENT_COUNT = 9;
    uint8 public constant MAX_LEVEL = 40;
    /// @notice Basis points of each purchase that are burned. The rest goes to treasury.
    uint16 public constant BURN_BPS = 5_000;
    uint16 public constant PRICE_BASE_CPT = 20;
    uint16 public constant PRICE_STEP_CPT = 20;

    CPTToken public immutable cpt;
    address public treasury;

    mapping(address user => mapping(uint8 ingredientId => uint8 amount)) public level;

    event Upgraded(
        address indexed user,
        uint8 indexed ingredientId,
        uint8 level,
        uint256 price,
        uint256 burned,
        uint256 treasuryAmount
    );
    event TreasuryUpdated(address indexed treasury);

    error ZeroAddress();
    error InvalidTreasury(address treasury);
    error UnknownIngredient();
    error MaxLevel();

    constructor(address cpt_, address treasury_, address owner_) Ownable(owner_) {
        if (cpt_ == address(0)) revert ZeroAddress();
        cpt = CPTToken(cpt_);
        _setTreasury(treasury_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        _setTreasury(treasury_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Rarity weight for an ingredient. 10_000 is 1×. Order matches INGREDIENTS.
    function priceWeightBps(uint8 ingredientId) public pure returns (uint16) {
        if (ingredientId >= INGREDIENT_COUNT) revert UnknownIngredient();
        uint16[9] memory weights =
            [uint16(10_000), 11_000, 12_000, 16_000, 13_000, 15_000, 18_000, 20_000, 22_000];
        return weights[ingredientId];
    }

    /// @notice CPT required to buy the next level of one topping.
    /// @dev Unweighted whole CPT is 20 + 20 × currentLevel. The rarity weight scales it.
    function priceOf(uint8 ingredientId, uint8 currentLevel) public pure returns (uint256) {
        if (currentLevel >= MAX_LEVEL) revert MaxLevel();
        uint256 unit = uint256(PRICE_BASE_CPT) + uint256(PRICE_STEP_CPT) * uint256(currentLevel);
        return unit * uint256(priceWeightBps(ingredientId)) * 1 ether / 10_000;
    }

    /// @notice Next price for `user`, or 0 when that ingredient is already maxed.
    function nextPrice(address user, uint8 ingredientId) external view returns (uint256) {
        if (ingredientId >= INGREDIENT_COUNT) revert UnknownIngredient();
        uint8 current = level[user][ingredientId];
        if (current >= MAX_LEVEL) return 0;
        return priceOf(ingredientId, current);
    }

    /// @notice Levels for ingredient ids 0..8. Index matches packages/shared INGREDIENTS.
    function levelsOf(address user) external view returns (uint8[9] memory out) {
        for (uint8 i = 0; i < INGREDIENT_COUNT; ++i) {
            out[i] = level[user][i];
        }
    }

    /// @notice Pull `priceOf(current)` CPT from the caller, burn half, pay the treasury, and increment.
    function purchase(uint8 ingredientId) external nonReentrant whenNotPaused {
        if (ingredientId >= INGREDIENT_COUNT) revert UnknownIngredient();

        uint8 current = level[msg.sender][ingredientId];
        if (current >= MAX_LEVEL) revert MaxLevel();

        uint256 price = priceOf(ingredientId, current);
        uint256 burned = (price * BURN_BPS) / 10_000;
        uint256 treasuryAmount = price - burned;
        uint8 nextLevel = current + 1;

        IERC20 token = IERC20(address(cpt));
        token.safeTransferFrom(msg.sender, address(this), price);
        if (burned != 0) cpt.burn(burned);
        if (treasuryAmount != 0) token.safeTransfer(treasury, treasuryAmount);

        level[msg.sender][ingredientId] = nextLevel;
        emit Upgraded(msg.sender, ingredientId, nextLevel, price, burned, treasuryAmount);
    }

    function _setTreasury(address treasury_) internal {
        if (treasury_ == address(0) || treasury_ == address(this)) {
            revert InvalidTreasury(treasury_);
        }
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }
}
