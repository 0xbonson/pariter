// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {BatchPayout} from "../../src/BatchPayout.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

contract BatchPayoutHandler is Test {
    BatchPayout public immutable payoutContract;
    MockUSDC public immutable usdc;

    address[] public callers;
    uint256 public batchNonce;

    constructor(BatchPayout _payoutContract, MockUSDC _usdc) {
        payoutContract = _payoutContract;
        usdc = _usdc;

        // Register candidate callers
        callers.push(address(0xA1));
        callers.push(address(0xA2));
        callers.push(address(0xA3));

        for (uint256 i = 0; i < callers.length; i++) {
            usdc.mint(callers[i], 1_000_000 * 1e6);
            vm.prank(callers[i]);
            usdc.approve(address(payoutContract), type(uint256).max);
        }
    }

    function executeRandomBatch(uint8 countSeed, uint32 amountSeed) external {
        uint256 count = (uint256(countSeed) % 10) + 1; // 1 to 10 recipients
        uint256 amount = (uint256(amountSeed) % 500 + 1) * 1e6; // 1 to 500 USDC

        address caller = callers[batchNonce % callers.length];
        batchNonce++;

        address[] memory recipients = new address[](count);
        uint256[] memory amounts = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            recipients[i] = address(uint160(0xB000 + i));
            amounts[i] = amount;
        }

        bytes32 batchId = keccak256(abi.encodePacked(caller, batchNonce));
        bytes32 commitment = keccak256(abi.encodePacked("invariant-run", batchNonce));

        vm.prank(caller);
        payoutContract.executeBatch(recipients, amounts, batchId, commitment);
    }
}

contract BatchPayoutInvariantTest is StdInvariant, Test {
    BatchPayout public payoutContract;
    MockUSDC public usdc;
    BatchPayoutHandler public handler;

    function setUp() public {
        usdc = new MockUSDC();
        payoutContract = new BatchPayout(address(usdc));
        handler = new BatchPayoutHandler(payoutContract, usdc);

        targetContract(address(handler));
    }

    function invariant_ContractNeverRetainsFunds() public view {
        assertEq(
            usdc.balanceOf(address(payoutContract)),
            0,
            "CRITICAL INVARIANT VIOLATION: BatchPayout contract retained non-zero USDC"
        );
    }
}
