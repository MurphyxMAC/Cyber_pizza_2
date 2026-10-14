// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CPTToken} from "./CPTToken.sol";

/// @title PizzaRewards
/// @notice Mints CPT for a server-signed Claim. The nonce must match exactly, then increments by one.
/// @dev EIP-712 type: Claim(address user,uint256 amount,uint256 nonce,uint256 deadline)
contract PizzaRewards is EIP712, Ownable, Pausable, ReentrancyGuard {
    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("Claim(address user,uint256 amount,uint256 nonce,uint256 deadline)");

    CPTToken public immutable cpt;

    address public signer;
    uint256 public dailyMintCap;
    uint256 public mintedInWindow;
    uint256 public windowStart;

    mapping(address user => uint256 nonce) public nonces;

    event Claimed(address indexed user, uint256 amount, uint256 nonce);
    event SignerUpdated(address indexed signer);
    event DailyMintCapUpdated(uint256 cap);

    error ZeroAddress();
    error ZeroAmount();
    error Expired(uint256 deadline, uint256 nowTs);
    error InvalidNonce(uint256 expected, uint256 provided);
    error InvalidSigner();
    error NotUser(address caller, address user);
    error DailyCapExceeded(uint256 requested, uint256 remaining);

    constructor(address cpt_, address signer_, address owner_, uint256 dailyMintCap_)
        EIP712("PizzaRewards", "1")
        Ownable(owner_)
    {
        if (cpt_ == address(0) || signer_ == address(0)) revert ZeroAddress();
        cpt = CPTToken(cpt_);
        signer = signer_;
        dailyMintCap = dailyMintCap_;
        windowStart = block.timestamp;
    }

    function setSigner(address signer_) external onlyOwner {
        if (signer_ == address(0)) revert ZeroAddress();
        signer = signer_;
        emit SignerUpdated(signer_);
    }

    function setDailyMintCap(uint256 cap) external onlyOwner {
        dailyMintCap = cap;
        emit DailyMintCapUpdated(cap);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function remainingDailyCap() external view returns (uint256) {
        if (block.timestamp >= windowStart + 1 days) return dailyMintCap;
        if (mintedInWindow >= dailyMintCap) return 0;
        return dailyMintCap - mintedInWindow;
    }

    /// @notice Digest the off-chain signer must sign. Exposed so tests and operators can match the server.
    function hashClaim(address user, uint256 amount, uint256 nonce, uint256 deadline)
        external
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(CLAIM_TYPEHASH, user, amount, nonce, deadline)));
    }

    /// @notice Mint `amount` of CPT to `user`. Caller must be `user`.
    function claim(address user, uint256 amount, uint256 nonce, uint256 deadline, bytes calldata signature)
        external
        nonReentrant
        whenNotPaused
    {
        if (msg.sender != user) revert NotUser(msg.sender, user);
        if (amount == 0) revert ZeroAmount();
        if (block.timestamp > deadline) revert Expired(deadline, block.timestamp);

        uint256 expected = nonces[user];
        if (nonce != expected) revert InvalidNonce(expected, nonce);

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(CLAIM_TYPEHASH, user, amount, nonce, deadline)));
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != signer) revert InvalidSigner();

        uint256 remaining = _remaining();
        if (amount > remaining) revert DailyCapExceeded(amount, remaining);

        _consume(amount);
        nonces[user] = expected + 1;
        cpt.mint(user, amount);

        emit Claimed(user, amount, nonce);
    }

    function _remaining() internal view returns (uint256) {
        if (block.timestamp >= windowStart + 1 days) return dailyMintCap;
        if (mintedInWindow >= dailyMintCap) return 0;
        return dailyMintCap - mintedInWindow;
    }

    function _consume(uint256 amount) internal {
        if (block.timestamp >= windowStart + 1 days) {
            windowStart = block.timestamp;
            mintedInWindow = 0;
        }
        mintedInWindow += amount;
    }
}
