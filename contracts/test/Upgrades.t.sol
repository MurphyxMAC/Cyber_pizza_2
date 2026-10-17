// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {CPTToken} from "../src/CPTToken.sol";
import {Upgrades} from "../src/Upgrades.sol";

contract UpgradesTest is Test {
    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal user = makeAddr("user");
    address internal other = makeAddr("other");

    CPTToken internal token;
    Upgrades internal upgrades;

    uint256 internal constant USER_MINT = 40_000 ether;

    function setUp() public {
        token = new CPTToken(owner);
        upgrades = new Upgrades(address(token), treasury, owner);

        vm.startPrank(owner);
        token.grantRole(token.MINTER_ROLE(), owner);
        token.mint(user, USER_MINT);
        token.mint(other, 5 ether);
        vm.stopPrank();

        vm.prank(user);
        token.approve(address(upgrades), type(uint256).max);
    }

    function test_constantsMatchTheSharedCatalog() public view {
        assertEq(upgrades.INGREDIENT_COUNT(), 9);
        assertEq(upgrades.MAX_LEVEL(), 40);
        assertEq(upgrades.BURN_BPS(), 5_000);
        assertEq(upgrades.PRICE_BASE_CPT(), 20);
        assertEq(upgrades.PRICE_STEP_CPT(), 20);

        uint16[9] memory weights =
            [uint16(10_000), 11_000, 12_000, 16_000, 13_000, 15_000, 18_000, 20_000, 22_000];
        for (uint8 i = 0; i < 9; ++i) {
            assertEq(upgrades.priceWeightBps(i), weights[i]);
            assertEq(upgrades.priceOf(i, 0), uint256(20) * weights[i] * 1 ether / 10_000);
            assertEq(upgrades.priceOf(i, 1), uint256(40) * weights[i] * 1 ether / 10_000);
            assertEq(upgrades.priceOf(i, 39), uint256(800) * weights[i] * 1 ether / 10_000);
        }

        assertEq(upgrades.priceOf(0, 0), 20 ether);
        assertEq(upgrades.priceOf(0, 1), 40 ether);
        assertEq(upgrades.priceOf(8, 0), 44 ether);
        assertEq(upgrades.priceOf(8, 39), 1_760 ether);
    }

    function test_purchaseBurnsHalfAndPaysTreasury() public {
        uint256 supplyBefore = token.totalSupply();

        vm.expectEmit(true, true, false, true, address(upgrades));
        emit Upgrades.Upgraded(user, 1, 1, 22 ether, 11 ether, 11 ether);

        vm.prank(user);
        upgrades.purchase(1);

        assertEq(upgrades.level(user, 1), 1);
        assertEq(upgrades.level(user, 0), 0);
        assertEq(upgrades.level(other, 1), 0);
        assertEq(token.balanceOf(user), USER_MINT - 22 ether);
        assertEq(token.balanceOf(treasury), 11 ether);
        assertEq(token.balanceOf(address(upgrades)), 0);
        assertEq(token.totalSupply(), supplyBefore - 11 ether);
        assertEq(upgrades.nextPrice(user, 1), 44 ether);
    }

    function test_priceRisesThroughFortyLevels() public {
        uint256 spent;
        for (uint8 i = 0; i < 40; ++i) {
            uint256 price = upgrades.priceOf(0, i);
            assertEq(price, (20 + 20 * uint256(i)) * 1 ether);
            uint256 supply = token.totalSupply();
            vm.prank(user);
            upgrades.purchase(0);
            spent += price;
            assertEq(upgrades.level(user, 0), i + 1);
            assertEq(token.balanceOf(user), USER_MINT - spent);
            assertEq(token.totalSupply(), supply - price / 2);
        }

        assertEq(spent, 16_400 ether);
        assertEq(upgrades.nextPrice(user, 0), 0);
        assertEq(token.balanceOf(treasury), 8_200 ether);

        vm.expectRevert(Upgrades.MaxLevel.selector);
        vm.prank(user);
        upgrades.purchase(0);

        vm.expectRevert(Upgrades.MaxLevel.selector);
        upgrades.priceOf(0, 40);
    }

    function test_levelsOfReturnsEveryIngredient() public {
        vm.prank(user);
        upgrades.purchase(3);
        vm.prank(user);
        upgrades.purchase(8);
        vm.prank(user);
        upgrades.purchase(8);

        uint8[9] memory levels = upgrades.levelsOf(user);
        assertEq(levels[3], 1);
        assertEq(levels[8], 2);
        assertEq(levels[1], 0);
        assertEq(upgrades.levelsOf(other)[3], 0);
    }

    function test_unknownIngredientReverts() public {
        vm.expectRevert(Upgrades.UnknownIngredient.selector);
        vm.prank(user);
        upgrades.purchase(9);

        vm.expectRevert(Upgrades.UnknownIngredient.selector);
        upgrades.nextPrice(user, 9);

        vm.expectRevert(Upgrades.UnknownIngredient.selector);
        upgrades.priceWeightBps(9);

        vm.expectRevert(Upgrades.UnknownIngredient.selector);
        upgrades.priceOf(9, 0);
    }

    function test_insufficientAllowanceReverts() public {
        vm.prank(other);
        token.approve(address(upgrades), 1 ether);

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector,
                address(upgrades),
                1 ether,
                20 ether
            )
        );
        vm.prank(other);
        upgrades.purchase(0);
        assertEq(upgrades.level(other, 0), 0);
    }

    function test_insufficientBalanceReverts() public {
        address broke = makeAddr("broke");
        vm.prank(broke);
        token.approve(address(upgrades), type(uint256).max);

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, broke, 0, 26 ether
            )
        );
        vm.prank(broke);
        upgrades.purchase(4);
        assertEq(upgrades.level(broke, 4), 0);
    }

    function test_pauseBlocksPurchase() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user));
        vm.prank(user);
        upgrades.pause();

        vm.prank(owner);
        upgrades.pause();

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(user);
        upgrades.purchase(0);

        vm.prank(owner);
        upgrades.unpause();
        vm.prank(user);
        upgrades.purchase(0);
        assertEq(upgrades.level(user, 0), 1);
    }

    function test_setTreasuryOnlyOwnerAndRejectsZeroOrSelf() public {
        address next = makeAddr("nextTreasury");

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user));
        vm.prank(user);
        upgrades.setTreasury(next);

        vm.expectRevert(abi.encodeWithSelector(Upgrades.InvalidTreasury.selector, address(0)));
        vm.prank(owner);
        upgrades.setTreasury(address(0));

        vm.expectRevert(
            abi.encodeWithSelector(Upgrades.InvalidTreasury.selector, address(upgrades))
        );
        vm.prank(owner);
        upgrades.setTreasury(address(upgrades));

        vm.prank(owner);
        upgrades.setTreasury(next);
        assertEq(upgrades.treasury(), next);

        vm.prank(user);
        upgrades.purchase(2);
        assertEq(token.balanceOf(next), 12 ether);
        assertEq(token.balanceOf(treasury), 0);
    }

    function test_constructorRejectsBadAddresses() public {
        vm.expectRevert(Upgrades.ZeroAddress.selector);
        new Upgrades(address(0), treasury, owner);

        vm.expectRevert(abi.encodeWithSelector(Upgrades.InvalidTreasury.selector, address(0)));
        new Upgrades(address(token), address(0), owner);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new Upgrades(address(token), treasury, address(0));
    }

    function testFuzz_onePurchaseOfAnyIngredient(uint8 ingredientId) public {
        ingredientId = ingredientId % 9;
        uint256 price = upgrades.priceOf(ingredientId, 0);
        vm.prank(user);
        upgrades.purchase(ingredientId);
        assertEq(upgrades.level(user, ingredientId), 1);
        assertEq(token.balanceOf(treasury), price / 2);
        assertEq(token.balanceOf(address(upgrades)), 0);
    }
}
