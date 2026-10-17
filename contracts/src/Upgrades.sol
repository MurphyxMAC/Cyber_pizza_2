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
///      Prices and the burn share are constants: level 0→1 costs 5 CPT and each further
///      level doubles (10, 20, 40, 80). Half of every price is burned. The other half
///      is transferred to `treasury`. Cooldown math lives off-chain; this contract only
///      stores the level the server reads.
contract Upgrades is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 public constant INGREDIENT_COUNT = 9;
    uint8 public constant MAX_LEVEL = 5;
    /// @notice Basis points of each purchase that are burned. The rest goes to treasury.
    uint16 public constant BURN_BPS = 5_000;

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

    /// @notice CPT required to buy the next level, given the buyer's current level.
    /// @dev Level 0 → 5 CPT, then 10, 20, 40, 80. Reverts at MAX_LEVEL.
    function priceOf(uint8 currentLevel) public pure returns (uint256) {
        if (currentLevel >= MAX_LEVEL) revert MaxLevel();
        return (5 ether) << currentLevel;
    }

    /// @notice Next price for `user`, or 0 when that ingredient is already maxed.
    function nextPrice(address user, uint8 ingredientId) external view returns (uint256) {
        if (ingredientId >= INGREDIENT_COUNT) revert UnknownIngredient();
        uint8 current = level[user][ingredientId];
        if (current >= MAX_LEVEL) return 0;
        return priceOf(current);
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

        uint256 price = priceOf(current);
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
