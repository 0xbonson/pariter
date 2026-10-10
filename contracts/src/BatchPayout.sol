// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BatchPayout
 * @notice Independent non-custodial multi-recipient USDC payment settlement contract for Arc Mainnet.
 * @dev Transfers exact USDC ERC-20 units atomically from payer to recipients.
 *      Retains zero custody of funds. Features scoped replay protection per payer.
 */
contract BatchPayout is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Maximum allowed recipients in a single batch to guarantee execution within gas limits.
    uint256 public constant MAX_BATCH_SIZE = 250;

    /// @notice Canonical ERC-20 USDC token interface contract on the network.
    IERC20 public immutable usdc;

    /// @notice Tracks executed batch identifiers per payer address to prevent replay attacks.
    /// @dev payer => batchId => isExecuted
    mapping(address => mapping(bytes32 => bool)) public isBatchExecuted;

    // --- Events ---

    /**
     * @notice Emitted upon successful atomic execution of a complete payout batch.
     * @param payer The address originating and funding the batch payment.
     * @param batchId The unique identifier generated for this batch.
     * @param referenceCommitment Cryptographic hash committing to offchain metadata (e.g. payout purpose).
     * @param recipientCount The total number of individual payments executed in this batch.
     * @param totalTransferred The exact sum of USDC (in 6-decimal base units) transferred.
     */
    event BatchSettled(
        address indexed payer,
        bytes32 indexed batchId,
        bytes32 referenceCommitment,
        uint256 recipientCount,
        uint256 totalTransferred
    );

    /**
     * @notice Emitted for each individual recipient payment within a batch.
     * @param payer The address funding the payout.
     * @param batchId The unique batch identifier.
     * @param recipient The destination address receiving the USDC transfer.
     * @param amount The individual transfer amount (6-decimal base units).
     * @param index The zero-indexed position of this payment within the batch.
     */
    event PayoutExecuted(
        address indexed payer,
        bytes32 indexed batchId,
        address indexed recipient,
        uint256 amount,
        uint256 index
    );

    // --- Custom Errors ---

    error ZeroTokenAddress();
    error EmptyBatch();
    error ArrayLengthMismatch();
    error BatchSizeExceeded(uint256 length, uint256 max);
    error InvalidRecipient(uint256 index);
    error RecipientCannotBeSelf(uint256 index);
    error ZeroAmount(uint256 index);
    error BatchAlreadyExecuted(address payer, bytes32 batchId);
    error BalanceMismatch(uint256 balanceBefore, uint256 balanceAfter);

    /**
     * @notice Initializes the BatchPayout contract with the immutable USDC token address.
     * @param _usdc The address of the canonical USDC ERC-20 contract (e.g., 0x3600... on Arc Mainnet).
     */
    constructor(address _usdc) {
        if (_usdc == address(0)) revert ZeroTokenAddress();
        usdc = IERC20(_usdc);
    }

    /**
     * @notice Atomically settles a multi-recipient batch payout of USDC.
     * @dev Payer must approve this contract for at least `totalTransferred` before execution.
     *      All transfers must succeed or the entire batch reverts.
     *      Contract retains zero net USDC balance after execution.
     * @param recipients Array of destination addresses.
     * @param amounts Array of transfer amounts in USDC base units (6 decimals).
     * @param batchId Unique 32-byte identifier scoped to msg.sender.
     * @param referenceCommitment 32-byte commitment hash (e.g. keccak256 hash of memo/descriptions).
     * @return totalTransferred The total USDC base units transferred to all recipients.
     */
    function executeBatch(
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32 batchId,
        bytes32 referenceCommitment
    ) external nonReentrant returns (uint256 totalTransferred) {
        uint256 length = recipients.length;

        // Validation
        if (length == 0) revert EmptyBatch();
        if (length != amounts.length) revert ArrayLengthMismatch();
        if (length > MAX_BATCH_SIZE) revert BatchSizeExceeded(length, MAX_BATCH_SIZE);
        if (isBatchExecuted[msg.sender][batchId]) revert BatchAlreadyExecuted(msg.sender, batchId);

        // Mark batch as executed for msg.sender (Replay Protection)
        isBatchExecuted[msg.sender][batchId] = true;

        // Calculate total amount and validate inputs
        for (uint256 i = 0; i < length; ) {
            address recipient = recipients[i];
            uint256 amount = amounts[i];

            if (recipient == address(0)) revert InvalidRecipient(i);
            if (recipient == address(this)) revert RecipientCannotBeSelf(i);
            if (amount == 0) revert ZeroAmount(i);

            totalTransferred += amount;

            unchecked {
                ++i;
            }
        }

        uint256 balanceBefore = usdc.balanceOf(address(this));

        // Pull total exact authorized USDC from payer to this contract
        usdc.safeTransferFrom(msg.sender, address(this), totalTransferred);

        // Disburse each individual payout and emit granular event
        for (uint256 i = 0; i < length; ) {
            address recipient = recipients[i];
            uint256 amount = amounts[i];

            usdc.safeTransfer(recipient, amount);
            emit PayoutExecuted(msg.sender, batchId, recipient, amount, i);

            unchecked {
                ++i;
            }
        }

        // Post-condition: Ensure exact conservation of balance (zero net retention for batch)
        uint256 balanceAfter = usdc.balanceOf(address(this));
        if (balanceAfter != balanceBefore) revert BalanceMismatch(balanceBefore, balanceAfter);

        // Emit high-level settlement confirmation
        emit BatchSettled(
            msg.sender,
            batchId,
            referenceCommitment,
            length,
            totalTransferred
        );

        return totalTransferred;
    }

    /**
     * @notice Helper to check if a specific batchId has been executed by a payer.
     * @param payer The payer address.
     * @param batchId The batch identifier to query.
     * @return True if executed, false otherwise.
     */
    function hasBatchExecuted(address payer, bytes32 batchId) external view returns (bool) {
        return isBatchExecuted[payer][batchId];
    }
}
