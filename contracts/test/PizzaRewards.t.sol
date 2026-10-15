// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {CPTToken} from "../src/CPTToken.sol";
import {PizzaRewards} from "../src/PizzaRewards.sol";

contract PizzaRewardsTest is Test {
    uint256 internal signerPk = 0xA11CE;
    address internal signer;
    address internal owner = makeAddr("owner");
    address internal user = makeAddr("user");
    address internal other = makeAddr("other");

    CPTToken internal token;
    PizzaRewards internal rewards;

    function setUp() public {
        signer = vm.addr(signerPk);
        token = new CPTToken(owner);
        rewards = new PizzaRewards(address(token), signer, owner, 1_000 ether);
        bytes32 role = token.MINTER_ROLE();
        vm.prank(owner);
        token.grantRole(role, address(rewards));
    }

    function test_claimMintsAndIncrementsNonce() public {
        _claim(user, 10 ether, signerPk);
        assertEq(token.balanceOf(user), 10 ether);
        assertEq(rewards.nonces(user), 1);
        assertEq(rewards.mintedInWindow(), 10 ether);
    }

    function test_replayReverts() public {
        uint256 nonce = rewards.nonces(user);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = _sign(signerPk, user, 10 ether, nonce, deadline);

        vm.prank(user);
        rewards.claim(user, 10 ether, nonce, deadline, signature);

        vm.expectRevert(abi.encodeWithSelector(PizzaRewards.InvalidNonce.selector, 1, nonce));
        vm.prank(user);
        rewards.claim(user, 10 ether, nonce, deadline, signature);
    }

    function test_expiredReverts() public {
        uint256 deadline = block.timestamp + 10;
        bytes memory signature = _sign(signerPk, user, 1 ether, 0, deadline);
        vm.warp(deadline + 1);

        vm.expectRevert(abi.encodeWithSelector(PizzaRewards.Expired.selector, deadline, deadline + 1));
        vm.prank(user);
        rewards.claim(user, 1 ether, 0, deadline, signature);
        assertEq(rewards.nonces(user), 0);
        assertEq(token.balanceOf(user), 0);
    }

    function test_deadlineEqualToNowSucceeds() public {
        uint256 deadline = block.timestamp;
        bytes memory signature = _sign(signerPk, user, 1 ether, 0, deadline);
        vm.prank(user);
        rewards.claim(user, 1 ether, 0, deadline, signature);
        assertEq(token.balanceOf(user), 1 ether);
    }

    function test_wrongSignerReverts() public {
        uint256 attackerPk = 0xBEEF;
        bytes memory signature = _sign(attackerPk, user, 4 ether, 0, block.timestamp + 1 hours);

        vm.expectRevert(PizzaRewards.InvalidSigner.selector);
        vm.prank(user);
        rewards.claim(user, 4 ether, 0, block.timestamp + 1 hours, signature);
        assertEq(rewards.nonces(user), 0);
    }

    function test_malformedSignatureReverts() public {
        vm.expectRevert();
        vm.prank(user);
        rewards.claim(user, 1 ether, 0, block.timestamp + 1 hours, hex"1234");
    }

    function test_senderMustBeUser() public {
        bytes memory signature = _sign(signerPk, user, 2 ether, 0, block.timestamp + 1 hours);
        vm.expectRevert(abi.encodeWithSelector(PizzaRewards.NotUser.selector, other, user));
        vm.prank(other);
        rewards.claim(user, 2 ether, 0, block.timestamp + 1 hours, signature);
    }

    function test_wrongNonceReverts() public {
        bytes memory signature = _sign(signerPk, user, 2 ether, 1, block.timestamp + 1 hours);
        vm.expectRevert(abi.encodeWithSelector(PizzaRewards.InvalidNonce.selector, 0, 1));
        vm.prank(user);
        rewards.claim(user, 2 ether, 1, block.timestamp + 1 hours, signature);
    }

    function test_zeroAmountReverts() public {
        bytes memory signature = _sign(signerPk, user, 0, 0, block.timestamp + 1 hours);
        vm.expectRevert(PizzaRewards.ZeroAmount.selector);
        vm.prank(user);
        rewards.claim(user, 0, 0, block.timestamp + 1 hours, signature);
    }

    function test_sequentialNonces() public {
        _claim(user, 1 ether, signerPk);
        _claim(user, 2 ether, signerPk);
        _claim(user, 3 ether, signerPk);
        assertEq(rewards.nonces(user), 3);
        assertEq(token.balanceOf(user), 6 ether);
    }

    function test_pauseBlocksClaimAndUnpauseRestores() public {
        vm.prank(owner);
        rewards.pause();

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = _sign(signerPk, user, 1 ether, 0, deadline);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(user);
        rewards.claim(user, 1 ether, 0, deadline, signature);

        vm.prank(owner);
        rewards.unpause();
        vm.prank(user);
        rewards.claim(user, 1 ether, 0, deadline, signature);
        assertEq(token.balanceOf(user), 1 ether);
    }

    function test_setSignerOnlyOwnerAndNewSignerWorks() public {
        uint256 newPk = 0xC0FFEE;
        address nextSigner = vm.addr(newPk);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user));
        vm.prank(user);
        rewards.setSigner(nextSigner);

        vm.prank(owner);
        rewards.setSigner(nextSigner);
        assertEq(rewards.signer(), nextSigner);

        bytes memory stale = _sign(signerPk, user, 1 ether, 0, block.timestamp + 1 hours);
        vm.expectRevert(PizzaRewards.InvalidSigner.selector);
        vm.prank(user);
        rewards.claim(user, 1 ether, 0, block.timestamp + 1 hours, stale);

        _claim(user, 1 ether, newPk);
        assertEq(token.balanceOf(user), 1 ether);
    }

    function test_setSignerRejectsZero() public {
        vm.expectRevert(PizzaRewards.ZeroAddress.selector);
        vm.prank(owner);
        rewards.setSigner(address(0));
    }

    function test_exactCapSucceedsAndNextWeiReverts() public {
        vm.prank(owner);
        rewards.setDailyMintCap(10 ether);
        _claim(user, 10 ether, signerPk);
        assertEq(rewards.remainingDailyCap(), 0);

        _expectCapRevert(other, 1, 0);
    }

    function test_capIsGlobalAcrossUsers() public {
        vm.prank(owner);
        rewards.setDailyMintCap(10 ether);
        _claim(user, 6 ether, signerPk);
        _claim(other, 4 ether, signerPk);
        assertEq(token.balanceOf(user), 6 ether);
        assertEq(token.balanceOf(other), 4 ether);

        _expectCapRevert(user, 1 ether, 0);
    }

    function test_windowResetsAfterOneDay() public {
        vm.prank(owner);
        rewards.setDailyMintCap(5 ether);
        _claim(user, 5 ether, signerPk);

        vm.warp(block.timestamp + 1 days);
        assertEq(rewards.remainingDailyCap(), 5 ether);
        _claim(user, 5 ether, signerPk);
        assertEq(token.balanceOf(user), 10 ether);
        assertEq(rewards.mintedInWindow(), 5 ether);
    }

    function testFuzz_amountWithinCapMints(uint96 rawCap, uint96 rawAmount) public {
        uint256 cap = bound(uint256(rawCap), 1, 1_000_000 ether);
        uint256 amount = bound(uint256(rawAmount), 1, cap);
        vm.prank(owner);
        rewards.setDailyMintCap(cap);

        _claim(user, amount, signerPk);

        assertEq(token.balanceOf(user), amount);
        assertEq(rewards.nonces(user), 1);
        assertEq(rewards.mintedInWindow(), amount);
        assertEq(rewards.remainingDailyCap(), cap - amount);
    }

    function testFuzz_amountAboveCapReverts(uint96 rawCap, uint96 rawExtra) public {
        uint256 cap = bound(uint256(rawCap), 0, 1_000_000 ether);
        uint256 extra = bound(uint256(rawExtra), 1, 1_000 ether);
        vm.prank(owner);
        rewards.setDailyMintCap(cap);

        uint256 amount = cap + extra;
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = _sign(signerPk, user, amount, 0, deadline);

        vm.expectRevert(abi.encodeWithSelector(PizzaRewards.DailyCapExceeded.selector, amount, cap));
        vm.prank(user);
        rewards.claim(user, amount, 0, deadline, signature);

        assertEq(token.balanceOf(user), 0);
        assertEq(rewards.nonces(user), 0);
        assertEq(rewards.mintedInWindow(), 0);
    }

    function testFuzz_cumulativeClaimsStopAtCap(uint96 rawA, uint96 rawB) public {
        uint256 amountA = bound(uint256(rawA), 1, 500 ether);
        uint256 amountB = bound(uint256(rawB), 1, 500 ether);
        vm.prank(owner);
        rewards.setDailyMintCap(amountA + amountB);

        _claim(user, amountA, signerPk);
        _claim(user, amountB, signerPk);
        assertEq(token.balanceOf(user), amountA + amountB);

        _expectCapRevert(user, 1, 0);
    }

    function test_nonOwnerCannotSetCapOrPause() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user));
        vm.prank(user);
        rewards.setDailyMintCap(1);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user));
        vm.prank(user);
        rewards.pause();
    }

    function test_constructorRejectsZeroAddresses() public {
        vm.expectRevert(PizzaRewards.ZeroAddress.selector);
        new PizzaRewards(address(0), signer, owner, 1);
        vm.expectRevert(PizzaRewards.ZeroAddress.selector);
        new PizzaRewards(address(token), address(0), owner, 1);
    }

    function _expectCapRevert(address account, uint256 amount, uint256 remaining) internal {
        uint256 nonce = rewards.nonces(account);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = _sign(signerPk, account, amount, nonce, deadline);
        vm.expectRevert(abi.encodeWithSelector(PizzaRewards.DailyCapExceeded.selector, amount, remaining));
        vm.prank(account);
        rewards.claim(account, amount, nonce, deadline, signature);
    }

    function _claim(address account, uint256 amount, uint256 pk) internal {
        uint256 nonce = rewards.nonces(account);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = _sign(pk, account, amount, nonce, deadline);
        vm.prank(account);
        rewards.claim(account, amount, nonce, deadline, signature);
    }

    function _sign(uint256 pk, address account, uint256 amount, uint256 nonce, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = rewards.hashClaim(account, amount, nonce, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }
}
