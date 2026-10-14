// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {CPTToken} from "../src/CPTToken.sol";

contract CPTTokenTest is Test {
    CPTToken internal token;
    address internal admin = makeAddr("admin");
    address internal minter = makeAddr("minter");
    address internal alice = makeAddr("alice");

    function setUp() public {
        token = new CPTToken(admin);
        bytes32 role = token.MINTER_ROLE();
        vm.prank(admin);
        token.grantRole(role, minter);
    }

    function test_metadata() public view {
        assertEq(token.name(), "CyberPizza Token");
        assertEq(token.symbol(), "CPT");
        assertEq(token.decimals(), 18);
    }

    function test_minterCanMint() public {
        vm.prank(minter);
        token.mint(alice, 10 ether);
        assertEq(token.balanceOf(alice), 10 ether);
        assertEq(token.totalSupply(), 10 ether);
    }

    function test_nonMinterCannotMint() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, address(this), token.MINTER_ROLE()
            )
        );
        token.mint(alice, 1 ether);
    }

    function test_holderCanBurn() public {
        vm.prank(minter);
        token.mint(alice, 5 ether);
        vm.prank(alice);
        token.burn(2 ether);
        assertEq(token.balanceOf(alice), 3 ether);
        assertEq(token.totalSupply(), 3 ether);
    }

    function test_adminCanRevokeMinter() public {
        bytes32 role = token.MINTER_ROLE();
        vm.prank(admin);
        token.revokeRole(role, minter);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, minter, role)
        );
        vm.prank(minter);
        token.mint(alice, 1);
    }

    function test_rejectZeroAdmin() public {
        vm.expectRevert(CPTToken.ZeroAddress.selector);
        new CPTToken(address(0));
    }
}
