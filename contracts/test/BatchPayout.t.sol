// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BatchPayout} from "../src/BatchPayout.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract BatchPayoutTest is Test {
    BatchPayout public payoutContract;
    MockUSDC public usdc;

    address public payer = address(0x1000);
    address public payer2 = address(0x2000);
    address public recipient1 = address(0x3001);
    address public recipient2 = address(0x3002);
    address public recipient3 = address(0x3003);

    bytes32 public sampleBatchId = keccak256("batch-001");
    bytes32 public sampleCommitment = keccak256("contributor-grant-oct-2026");

    event BatchSettled(
        address indexed payer,
        bytes32 indexed batchId,
        bytes32 referenceCommitment,
        uint256 recipientCount,
        uint256 totalTransferred
    );

    event PayoutExecuted(
        address indexed payer,
        bytes32 indexed batchId,
        address indexed recipient,
        uint256 amount,
        uint256 index
    );

    function setUp() public {
        usdc = new MockUSDC();
        payoutContract = new BatchPayout(address(usdc));

        // Fund payer with 10,000 USDC (6 decimals = 10_000 * 1e6)
        usdc.mint(payer, 10_000 * 1e6);
        usdc.mint(payer2, 10_000 * 1e6);

        vm.prank(payer);
        usdc.approve(address(payoutContract), type(uint256).max);

        vm.prank(payer2);
        usdc.approve(address(payoutContract), type(uint256).max);
    }

    // --- Constructor Tests ---

    function test_ConstructorRevertsOnZeroAddress() public {
        vm.expectRevert(BatchPayout.ZeroTokenAddress.selector);
        new BatchPayout(address(0));
    }

    function test_ConstructorInitializesCorrectly() public view {
        assertEq(address(payoutContract.usdc()), address(usdc));
        assertEq(payoutContract.MAX_BATCH_SIZE(), 250);
    }

    // --- Validation Reverts ---

    function test_RevertIfEmptyBatch() public {
        address[] memory recipients = new address[](0);
        uint256[] memory amounts = new uint256[](0);

        vm.prank(payer);
        vm.expectRevert(BatchPayout.EmptyBatch.selector);
        payoutContract.executeBatch(recipients, amounts, sampleBatchId, sampleCommitment);
    }

    function test_RevertIfArrayLengthMismatch() public {
        address[] memory recipients = new address[](2);
        recipients[0] = recipient1;
        recipients[1] = recipient2;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100 * 1e6;

        vm.prank(payer);
        vm.expectRevert(BatchPayout.ArrayLengthMismatch.selector);
        payoutContract.executeBatch(recipients, amounts, sampleBatchId, sampleCommitment);
    }

    function test_RevertIfBatchSizeExceeded() public {
        uint256 size = payoutContract.MAX_BATCH_SIZE() + 1; // 251
        address[] memory recipients = new address[](size);
        uint256[] memory amounts = new uint256[](size);

        for (uint256 i = 0; i < size; i++) {
            recipients[i] = address(uint160(0x5000 + i));
            amounts[i] = 1 * 1e6;
        }

        vm.prank(payer);
        vm.expectRevert(
            abi.encodeWithSelector(
                BatchPayout.BatchSizeExceeded.selector,
                size,
                payoutContract.MAX_BATCH_SIZE()
            )
        );
        payoutContract.executeBatch(recipients, amounts, sampleBatchId, sampleCommitment);
    }

    function test_RevertIfRecipientIsZeroAddress() public {
        address[] memory recipients = new address[](2);
        recipients[0] = recipient1;
        recipients[1] = address(0);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 50 * 1e6;
        amounts[1] = 50 * 1e6;

        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(BatchPayout.InvalidRecipient.selector, 1));
        payoutContract.executeBatch(recipients, amounts, sampleBatchId, sampleCommitment);
    }

    function test_RevertIfRecipientIsContractSelf() public {
        address[] memory recipients = new address[](1);
        recipients[0] = address(payoutContract);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 * 1e6;

        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(BatchPayout.RecipientCannotBeSelf.selector, 0));
        payoutContract.executeBatch(recipients, amounts, sampleBatchId, sampleCommitment);
    }

    function test_RevertIfAmountIsZero() public {
        address[] memory recipients = new address[](2);
        recipients[0] = recipient1;
        recipients[1] = recipient2;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 50 * 1e6;
        amounts[1] = 0;

        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(BatchPayout.ZeroAmount.selector, 1));
        payoutContract.executeBatch(recipients, amounts, sampleBatchId, sampleCommitment);
    }

    // --- Execution & Atomicity Tests ---

    function test_SingleRecipientPayoutSuccess() public {
        address[] memory recipients = new address[](1);
        recipients[0] = recipient1;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 500 * 1e6; // 500 USDC

        uint256 payerBefore = usdc.balanceOf(payer);
        uint256 r1Before = usdc.balanceOf(recipient1);

        vm.prank(payer);
        uint256 total = payoutContract.executeBatch(recipients, amounts, sampleBatchId, sampleCommitment);

        assertEq(total, 500 * 1e6);
        assertEq(usdc.balanceOf(payer), payerBefore - 500 * 1e6);
        assertEq(usdc.balanceOf(recipient1), r1Before + 500 * 1e6);
        assertEq(usdc.balanceOf(address(payoutContract)), 0);
        assertTrue(payoutContract.hasBatchExecuted(payer, sampleBatchId));
    }

    function test_MultiRecipientPayoutSuccess() public {
        address[] memory recipients = new address[](3);
        recipients[0] = recipient1;
        recipients[1] = recipient2;
        recipients[2] = recipient3;

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 250 * 1e6; // 250 USDC
        amounts[1] = 150 * 1e6; // 150 USDC
        amounts[2] = 100 * 1e6; // 100 USDC

        vm.prank(payer);
        uint256 total = payoutContract.executeBatch(recipients, amounts, sampleBatchId, sampleCommitment);

        assertEq(total, 500 * 1e6);
        assertEq(usdc.balanceOf(recipient1), 250 * 1e6);
        assertEq(usdc.balanceOf(recipient2), 150 * 1e6);
        assertEq(usdc.balanceOf(recipient3), 100 * 1e6);
        assertEq(usdc.balanceOf(address(payoutContract)), 0);
    }

    function test_EmitsAccurateEvents() public {
        address[] memory recipients = new address[](2);
        recipients[0] = recipient1;
        recipients[1] = recipient2;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100 * 1e6;
        amounts[1] = 200 * 1e6;

        vm.expectEmit(true, true, true, true);
        emit PayoutExecuted(payer, sampleBatchId, recipient1, 100 * 1e6, 0);

        vm.expectEmit(true, true, true, true);
        emit PayoutExecuted(payer, sampleBatchId, recipient2, 200 * 1e6, 1);

        vm.expectEmit(true, true, false, true);
        emit BatchSettled(payer, sampleBatchId, sampleCommitment, 2, 300 * 1e6);

        vm.prank(payer);
        payoutContract.executeBatch(recipients, amounts, sampleBatchId, sampleCommitment);
    }

    // --- Replay Protection Tests ---

    function test_RevertOnDuplicateBatchIdForSamePayer() public {
        address[] memory recipients = new address[](1);
        recipients[0] = recipient1;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 50 * 1e6;

        vm.prank(payer);
        payoutContract.executeBatch(recipients, amounts, sampleBatchId, sampleCommitment);

        // Attempt second execution with same batch ID
        vm.prank(payer);
        vm.expectRevert(
            abi.encodeWithSelector(BatchPayout.BatchAlreadyExecuted.selector, payer, sampleBatchId)
        );
        payoutContract.executeBatch(recipients, amounts, sampleBatchId, sampleCommitment);
    }

    function test_SameBatchIdAllowedForDifferentPayers() public {
        address[] memory recipients = new address[](1);
        recipients[0] = recipient1;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 50 * 1e6;

        // Payer 1 executes
        vm.prank(payer);
        payoutContract.executeBatch(recipients, amounts, sampleBatchId, sampleCommitment);

        // Payer 2 executes with identical batch ID - scoped per payer, must succeed
        vm.prank(payer2);
        payoutContract.executeBatch(recipients, amounts, sampleBatchId, sampleCommitment);

        assertTrue(payoutContract.hasBatchExecuted(payer, sampleBatchId));
        assertTrue(payoutContract.hasBatchExecuted(payer2, sampleBatchId));
        assertEq(usdc.balanceOf(recipient1), 100 * 1e6);
    }

    // --- Balance & Allowance Failures ---

    function test_RevertOnInsufficientAllowance() public {
        address[] memory recipients = new address[](1);
        recipients[0] = recipient1;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 500 * 1e6;

        // Set allowance to less than required
        vm.prank(payer);
        usdc.approve(address(payoutContract), 499 * 1e6);

        vm.prank(payer);
        vm.expectRevert();
        payoutContract.executeBatch(recipients, amounts, sampleBatchId, sampleCommitment);

        // Verify batch was NOT marked executed because call reverted
        assertFalse(payoutContract.hasBatchExecuted(payer, sampleBatchId));
    }

    function test_RevertOnInsufficientBalance() public {
        address poorPayer = address(0x9999);
        usdc.mint(poorPayer, 10 * 1e6); // only 10 USDC

        vm.prank(poorPayer);
        usdc.approve(address(payoutContract), type(uint256).max);

        address[] memory recipients = new address[](1);
        recipients[0] = recipient1;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 500 * 1e6; // requires 500 USDC

        vm.prank(poorPayer);
        vm.expectRevert();
        payoutContract.executeBatch(recipients, amounts, sampleBatchId, sampleCommitment);

        assertFalse(payoutContract.hasBatchExecuted(poorPayer, sampleBatchId));
    }

    // --- Atomicity & Failed Transfer Rollback ---

    function test_AtomicityRollbackOnTransferFailure() public {
        address[] memory recipients = new address[](2);
        recipients[0] = recipient1;
        recipients[1] = recipient2;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 50 * 1e6;
        amounts[1] = 50 * 1e6;

        // Simulate token transfer failure
        usdc.setFailTransfer(true);

        vm.prank(payer);
        vm.expectRevert();
        payoutContract.executeBatch(recipients, amounts, sampleBatchId, sampleCommitment);

        // Entire state must be rolled back: payer balance untouched, recipient untouched, batch not executed
        assertEq(usdc.balanceOf(payer), 10_000 * 1e6);
        assertEq(usdc.balanceOf(recipient1), 0);
        assertEq(usdc.balanceOf(recipient2), 0);
        assertFalse(payoutContract.hasBatchExecuted(payer, sampleBatchId));
    }

    // --- Gas & Scale: Max Batch Size Execution (250 recipients) ---

    function test_MaxBatchSizeExecution() public {
        uint256 size = 250;
        address[] memory recipients = new address[](size);
        uint256[] memory amounts = new uint256[](size);

        for (uint256 i = 0; i < size; i++) {
            recipients[i] = address(uint160(0x7000 + i));
            amounts[i] = 1 * 1e6; // 1 USDC each
        }

        vm.prank(payer);
        uint256 total = payoutContract.executeBatch(recipients, amounts, sampleBatchId, sampleCommitment);

        assertEq(total, 250 * 1e6);
        assertEq(usdc.balanceOf(address(payoutContract)), 0);
        assertEq(usdc.balanceOf(recipients[0]), 1 * 1e6);
        assertEq(usdc.balanceOf(recipients[249]), 1 * 1e6);
    }

    // --- Fuzz Testing ---

    function testFuzz_ExecuteBatchTotals(uint8 count, uint32 baseAmount) public {
        vm.assume(count > 0 && count <= 50);
        vm.assume(baseAmount > 0 && baseAmount <= 100_000); // 0.1 USDC max base to avoid payer balance depletion

        address[] memory recipients = new address[](count);
        uint256[] memory amounts = new uint256[](count);
        uint256 expectedTotal = 0;

        for (uint256 i = 0; i < count; i++) {
            recipients[i] = address(uint160(0x8000 + i));
            amounts[i] = uint256(baseAmount) * 1e6;
            expectedTotal += amounts[i];
        }

        // Mint sufficient funds to payer if needed
        if (usdc.balanceOf(payer) < expectedTotal) {
            usdc.mint(payer, expectedTotal);
        }

        bytes32 fuzzBatchId = keccak256(abi.encodePacked(count, baseAmount));

        vm.prank(payer);
        uint256 totalTransferred = payoutContract.executeBatch(
            recipients,
            amounts,
            fuzzBatchId,
            sampleCommitment
        );

        assertEq(totalTransferred, expectedTotal);
        assertEq(usdc.balanceOf(address(payoutContract)), 0);
    }
}
