// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {BatchPayout} from "../src/BatchPayout.sol";

/**
 * @title DeployBatchPayout
 * @notice Forge deployment script for BatchPayout on Arc Mainnet.
 * @dev Arc Mainnet USDC ERC-20 interface is 0x3600000000000000000000000000000000000000.
 */
contract DeployBatchPayout is Script {
    address public constant ARC_MAINNET_USDC = 0x3600000000000000000000000000000000000000;
    uint256 public constant ARC_MAINNET_CHAIN_ID = 5042;

    function run() external returns (BatchPayout batchPayout) {
        uint256 chainId = block.chainid;
        console.log("Deploying to Chain ID:", chainId);

        address usdcAddress;
        if (chainId == ARC_MAINNET_CHAIN_ID) {
            usdcAddress = ARC_MAINNET_USDC;
            console.log("Configured Arc Mainnet canonical USDC:", usdcAddress);
        } else {
            // Read from env or fallback for local / test networks
            usdcAddress = vm.envOr("USDC_ADDRESS", ARC_MAINNET_USDC);
            console.log("Configured USDC Address:", usdcAddress);
        }

        vm.startBroadcast();
        batchPayout = new BatchPayout(usdcAddress);
        vm.stopBroadcast();

        console.log("BatchPayout successfully deployed at:", address(batchPayout));
        console.log("Configured USDC address on contract:", address(batchPayout.usdc()));
        console.log("Max batch size:", batchPayout.MAX_BATCH_SIZE());
    }
}
